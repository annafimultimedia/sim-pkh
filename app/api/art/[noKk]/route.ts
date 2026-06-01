import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ noKk: string }> }) {
  const user = await getSession();
  const { noKk } = await params;
  const decodedNoKk = decodeURIComponent(noKk);

  const scope = user.role === "PENDAMPING" && user.districtId
    ? `AND EXISTS (
        SELECT 1 FROM reg_districts sd
        WHERE sd.id = ? AND UPPER(COALESCE(fc.kecamatan, a.kecamatan)) = UPPER(sd.name)
      )`
    : user.role === "PENDAMPING" && user.district
      ? "AND UPPER(COALESCE(fc.kecamatan, a.kecamatan)) = UPPER(?)"
      : "";
  const scopeParams = user.role === "PENDAMPING" && user.districtId ? [user.districtId] : user.role === "PENDAMPING" && user.district ? [user.district] : [];

  const rows = await query<{ noKk: string; nik: string; nama: string; komponen: string }>(
    `SELECT a.no_kk AS noKk, a.nik, a.nama, COALESCE(a.komponen, '') AS komponen
     FROM art_members a
     LEFT JOIN (
       SELECT no_kk, MAX(kecamatan) kecamatan
       FROM kpm_final_closing
       GROUP BY no_kk
     ) fc ON fc.no_kk = a.no_kk
     WHERE a.no_kk = ?
     ${scope}
     ORDER BY CASE WHEN UPPER(a.komponen) = 'PENGURUS' THEN 0 ELSE 1 END, a.nama`,
    [decodedNoKk, ...scopeParams]
  );

  return NextResponse.json({ rows });
}
