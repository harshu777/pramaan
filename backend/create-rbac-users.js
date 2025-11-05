const sqlite3 = require('sqlite3');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const db = new sqlite3.Database('./certificates.db');

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function createUsers() {
  console.log('🔧 Creating RBAC users...\n');

  const users = [
    {
      username: 'superadmin',
      password: 'SuperAdmin@123',
      name: 'Super Administrator',
      email: 'superadmin@epramaan.gov.in',
      organization: 'E-Pramaan System',
      role: 'super_admin'
    },
    {
      username: 'admin',
      password: 'Admin@123',
      name: 'System Administrator',
      email: 'admin@epramaan.gov.in',
      organization: 'Sports Department',
      role: 'admin'
    },
    {
      username: 'docmanager',
      password: 'DocManager@123',
      name: 'Document Manager',
      email: 'documents@epramaan.gov.in',
      organization: 'Document Management',
      role: 'document_manager'
    }
  ];

  for (const user of users) {
    const userId = uuidv4();
    const passwordHash = await hashPassword(user.password);

    // Check if user exists
    db.get('SELECT id FROM issuers WHERE username = ?', [user.username], async (err, existing) => {
      if (existing) {
        console.log(`⚠️  User ${user.username} already exists, skipping...`);
        return;
      }

      // Create user
      db.run(`
        INSERT INTO issuers (id, username, name, email, organization, password_hash, role, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `, [userId, user.username, user.name, user.email, user.organization, passwordHash, user.role], (err) => {
        if (err) {
          console.error(`❌ Error creating user ${user.username}:`, err);
          return;
        }

        // Assign role from admin_roles table
        db.get('SELECT id FROM admin_roles WHERE role_name = ?', [user.role], (err, role) => {
          if (err || !role) {
            console.log(`✅ Created user: ${user.username} (legacy role: ${user.role})`);
            return;
          }

          const assignmentId = uuidv4();
          db.run(`
            INSERT INTO user_role_assignments (id, user_id, role_id, assigned_by)
            VALUES (?, ?, ?, ?)
          `, [assignmentId, userId, role.id, 'system'], (err) => {
            if (err) {
              console.error(`   ⚠️  Could not assign role: ${err.message}`);
            }
            console.log(`✅ Created user: ${user.username} with role: ${user.role}`);
            console.log(`   Password: ${user.password}`);
            console.log(`   Email: ${user.email}\n`);
          });
        });
      });
    });
  }

  setTimeout(() => {
    console.log('\n📋 Summary:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Super Admin Login:');
    console.log('  URL: http://localhost:3000/static/login.html');
    console.log('  Username: superadmin');
    console.log('  Password: SuperAdmin@123');
    console.log('  Access: Full system access\n');

    console.log('Admin Login:');
    console.log('  URL: http://localhost:3000/static/login.html');
    console.log('  Username: admin');
    console.log('  Password: Admin@123');
    console.log('  Access: Certificate & Request management\n');

    console.log('Document Manager Login:');
    console.log('  URL: http://localhost:3000/static/document-manager-login.html');
    console.log('  Username: docmanager');
    console.log('  Password: DocManager@123');
    console.log('  Access: Document upload & bulk upload only\n');
    console.log('═══════════════════════════════════════════════════════════');

    db.close();
  }, 2000);
}

createUsers().catch(console.error);
