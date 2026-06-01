import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { pool } from "@/lib/db";
import { ensureGroupMemberNikColumn } from "@/lib/data";

export async function DELETE() {
  const user = await getSession();
  if (user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const connection = await pool.getConnection();
  try {
    await ensureGroupMemberNikColumn();
    await connection.beginTransaction();
    await connection.query(
      `UPDATE p2k2_group_members gm
       JOIN kpm_final_closing k ON k.id = gm.kpm_id
       SET gm.kpm_nik = COALESCE(gm.kpm_nik, k.nik),
           gm.kpm_id = NULL`
    );
    await connection.query("DELETE FROM kpm_final_closing");
    await connection.query("DELETE FROM import_batches WHERE type = 'FINAL_CLOSING'");
    await connection.query("INSERT INTO activity_logs (user_id, action, entity, description) VALUES (?, 'DELETE', 'kpm_final_closing', 'Kosongkan semua data Final Closing dan batch import')", [user.id]);
    await connection.commit();
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    await connection.rollback();
    return NextResponse.json({ message: error?.sqlMessage ?? error?.message ?? "Gagal mengosongkan data" }, { status: 500 });
  } finally {
    connection.release();
  }
}
