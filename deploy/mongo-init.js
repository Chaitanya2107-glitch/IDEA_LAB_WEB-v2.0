// Runs once, when the MongoDB data volume is first created (docker-entrypoint-initdb.d).
// Creates the application's own user:
//  - read/write on the portal database only;
//  - on the three sign-in log databases (Microsoft/admin, Google, email + password), only "add" and
//    "read": it cannot edit or delete the record of who signed in (only root could).
const dbName = process.env.MONGO_INITDB_DATABASE || 'idealab';
const auditDbName = process.env.MONGODB_AUDIT_DB || `${dbName}_audit`;
const googleAuditDbName = process.env.MONGODB_GOOGLE_AUDIT_DB || `${dbName}_audit_google`;
const passwordAuditDbName = process.env.MONGODB_PASSWORD_AUDIT_DB || `${dbName}_audit_password`;
const user = process.env.MONGO_APP_USER;
const pwd = process.env.MONGO_APP_PASSWORD;

if (!user || !pwd) {
  throw new Error('MONGO_APP_USER and MONGO_APP_PASSWORD must be set');
}

// Safe to run again on an existing database (see DEPLOYMENT.md): existing parts are kept.
const appendOnlyRole = (name) => {
  if (db.getSiblingDB(name).getRole('signInLogAppendOnly')) return;
  db.getSiblingDB(name).createRole({
    role: 'signInLogAppendOnly',
    privileges: [
      {
        resource: { db: name, collection: 'login_events' },
        actions: ['find', 'insert', 'createCollection', 'createIndex', 'listIndexes'],
      },
      { resource: { db: name, collection: '' }, actions: ['listCollections'] },
    ],
    roles: [],
  });
};
appendOnlyRole(auditDbName);
appendOnlyRole(googleAuditDbName);
appendOnlyRole(passwordAuditDbName);

const roles = [
  { role: 'readWrite', db: dbName },
  { role: 'signInLogAppendOnly', db: auditDbName },
  { role: 'signInLogAppendOnly', db: googleAuditDbName },
  { role: 'signInLogAppendOnly', db: passwordAuditDbName },
];
if (db.getSiblingDB(dbName).getUser(user)) {
  db.getSiblingDB(dbName).grantRolesToUser(user, roles);
} else {
  db.getSiblingDB(dbName).createUser({ user, pwd, roles });
}
print(`Created application user "${user}" for "${dbName}" (read/write), "${auditDbName}", "${googleAuditDbName}" and "${passwordAuditDbName}" (append-only)`);
