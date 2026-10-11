# MoOLVa ХАССП Easy 2.6 PRO — release gate

This is a **development branch**, not a released 2.6 installer.

## Safety rules
- Do not overwrite or ship any user's SQLite database.
- Back up %LOCALAPPDATA%\\MoOLVaHACCPStudio before upgrading.
- Do not declare the release ready unless all Windows tests and installer smoke tests pass.
- Preserve prior installation data and support rollback after failed upgrades.

## Priority implementation
1. Smart HACCP journals and journal templates by enterprise type.
2. Automatic date generation excluding weekends where configured, and employee assignments.
3. Deviation monitoring and corrective actions.
4. Verified SQLite backup/restore, closed connections, and atomic replace.
5. Update detection, running-process shutdown with user consent, and data-preserving migration.

## Remaining scope
Documents, stock, recipe cards, staff, equipment, QR, training, audit, search, roles, dashboards, Excel import, reporting and diagnostics require implementation and acceptance tests before being described as delivered.

## Existing baseline
Branch moolva-native-240 provides 2.4 overlay and a Windows backup patch. The 2.6 branch is not a completed build.
