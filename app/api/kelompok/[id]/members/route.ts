import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { pool, query } from "@/lib/db";
import { ensureGroupMemberNikColumn, getPendampingProfileForUser } from "@/lib/data";

type MappingItem = {
  kpmId: number;
  kpmNik: string;
};

async function ensureOwner(groupId: number, userId: number) {
  const profile = await getPendampingProfileForUser(userId);
  if (!profile) return null;
  const rows = await query<{ id: number }>("SELECT id FROM p2k2_groups WHERE id = ? AND pendamping_id = ? LIMIT 1", [groupId, profile.id]);
  return rows[0] ? profile : null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (user.role !== "PENDAMPING") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const groupId = Number(id);
  await ensureGroupMemberNikColumn();
  const profile = await ensureOwner(groupId, user.id);
  if (!profile) return NextResponse.json({ message: "Kelompok tidak ditemukan atau bukan milik Anda" }, { status: 404 });
  const body = await request.json();
  const items = normalizeItems(body);
  if (!items.length) return NextResponse.json({ message: "KPM belum dipilih" }, { status: 400 });

  const ids = [...new Set(items.map((item) => item.kpmId).filter((id) => id > 0))];
  if (!ids.length) return NextResponse.json({ message: "KPM tidak valid" }, { status: 400 });

  const idPlaceholders = ids.map(() => "?").join(",");
  const kpmRows = await query<{ id: number; nik: string }>(
    `SELECT id, nik FROM kpm_final_closing WHERE id IN (${idPlaceholders}) AND pendamping_id = ?`,
    [...ids, profile.id]
  );
  if (kpmRows.length !== ids.length) return NextResponse.json({ message: "Ada KPM yang bukan dampingan Anda" }, { status: 403 });

  const inputNikMap = new Map(items.map((item) => [item.kpmId, item.kpmNik]));
  const validRows = kpmRows.map((row) => ({
    id: Number(row.id),
    nik: String(inputNikMap.get(Number(row.id)) || row.nik).trim()
  })).filter((row) => row.nik);
  const niks = [...new Set(validRows.map((row) => row.nik))];
  if (!validRows.length || !niks.length) return NextResponse.json({ message: "NIK KPM tidak valid" }, { status: 400 });

  const checked = body.checked !== false;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const nikPlaceholders = niks.map(() => "?").join(",");

    if (checked) {
      await connection.query(
        `DELETE gm FROM p2k2_group_members gm
         JOIN p2k2_groups g ON g.id = gm.group_id
         LEFT JOIN kpm_final_closing k ON k.id = gm.kpm_id
         WHERE g.pendamping_id = ? AND gm.group_id <> ? AND COALESCE(gm.kpm_nik, k.nik) IN (${nikPlaceholders})`,
        [profile.id, groupId, ...niks]
      );
      await connection.query(
        `DELETE gm FROM p2k2_group_members gm
         LEFT JOIN kpm_final_closing k ON k.id = gm.kpm_id
         WHERE gm.group_id = ?
           AND COALESCE(gm.kpm_nik, k.nik) IN (${nikPlaceholders})
           AND (gm.kpm_id IS NULL OR gm.kpm_id NOT IN (${idPlaceholders}))`,
        [groupId, ...niks, ...ids]
      );
      await connection.query(
        "INSERT IGNORE INTO p2k2_group_members (group_id, kpm_id, kpm_nik) VALUES ?",
        [validRows.map((row) => [groupId, row.id, row.nik])]
      );
    } else {
      await connection.query(
        `DELETE gm FROM p2k2_group_members gm
         LEFT JOIN kpm_final_closing k ON k.id = gm.kpm_id
         WHERE gm.group_id = ? AND COALESCE(gm.kpm_nik, k.nik) IN (${nikPlaceholders})`,
        [groupId, ...niks]
      );
    }

    await connection.commit();
    return NextResponse.json({ ok: true, count: validRows.length });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function normalizeItems(body: any): MappingItem[] {
  const rawItems = Array.isArray(body.items)
    ? body.items
    : [{ kpmId: body.kpmId, kpmNik: body.kpmNik }];

  return rawItems
    .map((item: any) => ({
      kpmId: Number(item?.kpmId),
      kpmNik: String(item?.kpmNik ?? "").trim()
    }))
    .filter((item: MappingItem) => Number.isFinite(item.kpmId) && item.kpmId > 0);
}
