-- บัญชีฐานข้อมูลของแอป: อ่าน/เขียนข้อมูลได้อย่างเดียว (ไม่ใช่ superuser, สร้าง/ลบตารางไม่ได้)
-- รันด้วยบัญชีเจ้าของ schema:  psql -U csis -d csis -v app_password="'รหัสยาวๆ'" -f scripts/db-app-role.sql
-- แล้วตั้ง DATABASE_URL=postgresql://csis_app:<รหัส>@host:5432/csis และ MIGRATION_DATABASE_URL เป็นบัญชีเจ้าของ
CREATE ROLE csis_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD :app_password;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE csis TO csis_app;
GRANT USAGE ON SCHEMA public TO csis_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO csis_app;
REVOKE ALL ON TABLE _prisma_migrations FROM csis_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO csis_app;
ALTER DEFAULT PRIVILEGES FOR ROLE csis IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO csis_app;
ALTER DEFAULT PRIVILEGES FOR ROLE csis IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO csis_app;
