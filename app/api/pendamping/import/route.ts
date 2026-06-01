import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth";
import { pool, query } from "@/lib/db";
import { ensureP2k2GroupAreaColumns, ensurePendampingAssignmentHistoryTable, getActivePeriod } from "@/lib/data";

const defaultPassword = "pkh123";
const defaultRegencyId = "3509";

function readCell(row: Record<string, unknown>, names: string[]) {
  const entries = Object.entries(row);
  for (const name of names) {
    const found = entries.find(([key]) => key.trim().toLowerCase() === name.toLowerCase());
    if (found) return String(found[1] ?? "").trim();
  }
  return "";
}

export async function POST(request: Request) {
  const user = await getSession();
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ message: "File XLSX wajib dipilih" }, { status: 400 });
  const regencyId = String(form.get("regencyId") || defaultRegencyId);

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  const result = { imported: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const normalize = (value: string) => value.trim().toUpperCase();
  const activePeriod = await getActivePeriod();
  await ensureP2k2GroupAreaColumns();
  await ensurePendampingAssignmentHistoryTable();

  const districtRows = await query<{ id: string; regency_id: string; name: string }>(
    "SELECT id, regency_id, name FROM reg_districts WHERE regency_id = ?",
    [regencyId]
  );
  const districtMap = new Map(districtRows.map((district) => [normalize(district.name), district]));

  const profileRows = await query<{ id: number; user_id: number; nik: string; nip: string | null; district_id: string; regency_id: string; kpm_count: number }>(
    `SELECT p.id, p.user_id, p.nik, p.nip, p.district_id, p.regency_id,
            SUM(CASE WHEN k.year = ? AND k.stage = ? THEN 1 ELSE 0 END) AS kpm_count
     FROM pendamping_profiles p
     LEFT JOIN kpm_final_closing k ON k.pendamping_id = p.id
     GROUP BY p.id, p.user_id, p.nik, p.nip, p.district_id, p.regency_id`,
    [activePeriod.year, activePeriod.stage]
  );
  const profileByNik = new Map(profileRows.map((profile) => [profile.nik, profile]));
  const profileByNip = new Map(profileRows.filter((profile) => profile.nip).map((profile) => [profile.nip as string, profile]));
  const profileByUserId = new Map(profileRows.map((profile) => [profile.user_id, profile]));

  const userRows = await query<{ id: number; username: string; nik: string | null; nip: string | null }>(
    "SELECT id, username, nik, nip FROM users"
  );
  const userByUsername = new Map(userRows.map((item) => [item.username, item]));
  const userByNik = new Map(userRows.filter((item) => item.nik).map((item) => [item.nik as string, item]));
  const userByNip = new Map(userRows.filter((item) => item.nip).map((item) => [item.nip as string, item]));

  for (let index = 0; index < rows.length; index += 1) {
    try {
      const row = rows[index];
      const nik = readCell(row, ["NIK"]);
      const nip = readCell(row, ["NIP"]);
      const name = readCell(row, ["Nama", "NAMA"]);
      const districtName = readCell(row, ["Kecamatan", "Kecamatan (Tempat Tugas)", "Tempat Tugas"]);
      if (!nik || !name || !districtName) {
        result.skipped += 1;
        result.errors.push(`Baris ${index + 2}: NIK, Nama, dan Kecamatan wajib diisi`);
        continue;
      }

      const district = districtMap.get(normalize(districtName));
      if (!district) {
        result.skipped += 1;
        result.errors.push(`Baris ${index + 2}: Kecamatan "${districtName}" tidak ditemukan di KAB. JEMBER (ID ${regencyId})`);
        continue;
      }

      const existing = profileByNik.get(nik) ?? (nip ? profileByNip.get(nip) : undefined);

      if (existing) {
        if (existing.district_id !== district.id && Number(existing.kpm_count) > 0) {
          result.skipped += 1;
          result.errors.push(`Baris ${index + 2}: ${name} masih punya ${existing.kpm_count} KPM pada periode aktif. Keluarkan/mapping ulang KPM dulu sebelum pindah kecamatan.`);
          continue;
        }
        if (existing.district_id !== district.id) {
          await recordAssignmentMove(existing, district);
          await archiveActiveGroups(existing.id, activePeriod);
        }
        await query("UPDATE users SET name = ?, nik = ?, nip = ?, regency_id = ?, district_id = ?, is_active = 1 WHERE id = ?", [name, nik, nip || null, district.regency_id, district.id, existing.user_id]);
        await query("UPDATE pendamping_profiles SET nik = ?, nip = ?, name = ?, regency_id = ?, district_id = ? WHERE id = ?", [nik, nip || null, name, district.regency_id, district.id, existing.id]);
        result.updated += 1;
        continue;
      }

      const username = nip || nik;
      let matchedUser = userByUsername.get(username) ?? userByNik.get(nik) ?? (nip ? userByNip.get(nip) : undefined);
      let userId = matchedUser?.id;
      if (userId) {
        await query("UPDATE users SET username = ?, role = 'PENDAMPING', name = ?, nik = ?, nip = ?, regency_id = ?, district_id = ?, is_active = 1 WHERE id = ?", [username, name, nik, nip || null, district.regency_id, district.id, userId]);
      } else {
        const [insertUser] = await pool.execute(
          "INSERT INTO users (username, password_hash, role, name, nik, nip, regency_id, district_id) VALUES (?, ?, 'PENDAMPING', ?, ?, ?, ?, ?)",
          [username, passwordHash, name, nik, nip || null, district.regency_id, district.id]
        );
        userId = Number((insertUser as any).insertId);
        matchedUser = { id: userId, username, nik, nip };
        userByUsername.set(username, matchedUser);
        userByNik.set(nik, matchedUser);
        if (nip) userByNip.set(nip, matchedUser);
      }
      if (!userId) throw new Error("User pendamping gagal dibuat atau ditemukan");

      const profileForUser = profileByUserId.get(userId);
      if (profileForUser) {
        if (profileForUser.district_id !== district.id && Number(profileForUser.kpm_count) > 0) {
          result.skipped += 1;
          result.errors.push(`Baris ${index + 2}: ${name} masih punya ${profileForUser.kpm_count} KPM pada periode aktif. Keluarkan/mapping ulang KPM dulu sebelum pindah kecamatan.`);
          continue;
        }
        if (profileForUser.district_id !== district.id) {
          await recordAssignmentMove(profileForUser, district);
          await archiveActiveGroups(profileForUser.id, activePeriod);
        }
        await query("UPDATE pendamping_profiles SET nik = ?, nip = ?, name = ?, district_id = ?, regency_id = ? WHERE id = ?", [nik, nip || null, name, district.id, district.regency_id, profileForUser.id]);
        result.updated += 1;
        continue;
      }

      const [insertProfile] = await pool.execute(
        "INSERT INTO pendamping_profiles (user_id, nik, nip, name, district_id, regency_id) VALUES (?, ?, ?, ?, ?, ?)",
        [userId, nik, nip || null, name, district.id, district.regency_id]
      );
      const insertedProfile = { id: Number((insertProfile as any).insertId), user_id: userId, nik, nip: nip || null, district_id: district.id, regency_id: district.regency_id, kpm_count: 0 };
      await query(
        "INSERT INTO pendamping_assignment_history (pendamping_id, user_id, district_id, regency_id, started_at, note) VALUES (?, ?, ?, ?, CURDATE(), ?)",
        [insertedProfile.id, userId, district.id, district.regency_id, "Penugasan awal dari import pendamping"]
      );
      profileByUserId.set(userId, insertedProfile);
      profileByNik.set(nik, insertedProfile);
      if (nip) profileByNip.set(nip, insertedProfile);
      result.imported += 1;
    } catch (error: any) {
      result.skipped += 1;
      result.errors.push(`Baris ${index + 2}: ${error?.sqlMessage ?? error?.message ?? "Gagal diproses"}`);
    }
  }

  await query("INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'IMPORT', 'pendamping_profiles', ?)", [user.id, `Import pendamping: ${result.imported} baru, ${result.updated} update, ${result.skipped} dilewati`]);
  return NextResponse.json(result);
}

async function recordAssignmentMove(profile: { id: number; user_id: number; district_id: string; regency_id: string }, next: { id: string; regency_id: string }) {
  await query(
    "UPDATE pendamping_assignment_history SET ended_at = CURDATE() WHERE pendamping_id = ? AND ended_at IS NULL",
    [profile.id]
  );
  await query(
    "INSERT INTO pendamping_assignment_history (pendamping_id, user_id, district_id, regency_id, started_at, note) VALUES (?, ?, ?, ?, CURDATE(), ?)",
    [profile.id, profile.user_id, next.id, next.regency_id, "Pindah kecamatan tugas dari import pendamping"]
  );
}

async function archiveActiveGroups(pendampingId: number, activePeriod: { year: number; stage: number }) {
  await query(
    "UPDATE p2k2_groups SET archived_at = CURRENT_TIMESTAMP WHERE pendamping_id = ? AND year = ? AND stage = ? AND archived_at IS NULL",
    [pendampingId, activePeriod.year, activePeriod.stage]
  );
}
