import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database-sqlite';
import { asyncHandler } from '../middleware/asyncHandler';
import { logger } from '../utils/logger';
import {
  getSamlInstance,
  generateSpMetadata,
  parseSamlAttributes,
  SamlUserAttributes
} from '../config/saml';

const router = Router();

// Get SP Metadata - IDP will use this to configure the SP
router.get('/metadata', (req: Request, res: Response) => {
  const metadata = generateSpMetadata();
  res.type('application/xml');
  res.send(metadata);
});

// Initiate SAML login - redirects to IDP
router.get('/login', asyncHandler(async (req: Request, res: Response) => {
  try {
    const saml = getSamlInstance();

    // Generate the authorization URL
    const authUrl = await saml.getAuthorizeUrlAsync(
      '', // RelayState - can be used to store return URL
      req.headers.host || '',
      {}
    );

    logger.info('SAML login initiated, redirecting to IDP');
    res.redirect(authUrl);
  } catch (error) {
    logger.error('SAML login initiation error:', error);
    res.redirect('/static/athlete-login.html?error=saml_init_failed');
  }
}));

// Assertion Consumer Service (ACS) - receives SAML response from IDP
router.post('/acs', asyncHandler(async (req: Request, res: Response) => {
  try {
    const saml = getSamlInstance();
    const { SAMLResponse, RelayState } = req.body;

    if (!SAMLResponse) {
      logger.error('No SAMLResponse in request');
      return res.redirect('/static/athlete-login.html?error=no_saml_response');
    }

    logger.info('Processing SAML assertion...');

    // Validate the SAML response
    const { profile } = await saml.validatePostResponseAsync({
      SAMLResponse,
      RelayState
    });

    if (!profile) {
      logger.error('No profile in SAML response');
      return res.redirect('/static/athlete-login.html?error=invalid_saml_response');
    }

    logger.info('SAML profile received:', JSON.stringify(profile, null, 2));

    // Parse the SAML attributes
    const attributes = parseSamlAttributes(profile);

    if (!attributes.nameID) {
      logger.error('No nameID in SAML response');
      return res.redirect('/static/athlete-login.html?error=no_nameid');
    }

    // Find or create athlete based on SAML response
    const athlete = await findOrCreateSamlAthlete(attributes);

    // Generate JWT token
    const token = jwt.sign(
      { id: athlete.id, email: athlete.email, type: 'athlete' },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    logger.info(`SAML login successful for athlete: ${athlete.email || athlete.id}`);

    // Redirect to frontend with token
    // We use a special callback page that will store the token and redirect
    res.redirect(`/static/saml-callback.html?token=${encodeURIComponent(token)}&athlete=${encodeURIComponent(JSON.stringify({
      id: athlete.id,
      fullName: athlete.full_name,
      email: athlete.email,
      phoneNumber: athlete.phone_number,
      dob: athlete.dob,
      district: athlete.district,
      state: athlete.state
    }))}`);
  } catch (error: any) {
    logger.error('SAML ACS error:', error);

    // Handle specific SAML errors
    let errorMessage = 'saml_validation_failed';
    if (error.message?.includes('SAML assertion expired')) {
      errorMessage = 'assertion_expired';
    } else if (error.message?.includes('Invalid signature')) {
      errorMessage = 'invalid_signature';
    }

    res.redirect(`/static/athlete-login.html?error=${errorMessage}`);
  }
}));

// Single Logout Service (SLO)
router.get('/slo', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Clear any session data if needed
    logger.info('SAML logout initiated');
    res.redirect('/static/athlete-login.html?logout=success');
  } catch (error) {
    logger.error('SAML SLO error:', error);
    res.redirect('/static/athlete-login.html');
  }
}));

router.post('/slo', asyncHandler(async (req: Request, res: Response) => {
  try {
    logger.info('SAML logout POST received');
    res.redirect('/static/athlete-login.html?logout=success');
  } catch (error) {
    logger.error('SAML SLO POST error:', error);
    res.redirect('/static/athlete-login.html');
  }
}));

// Helper function to find or create athlete based on SAML attributes
async function findOrCreateSamlAthlete(attributes: SamlUserAttributes): Promise<any> {
  const { nameID, uuid, email, fullName, firstName, lastName, screenName, phone, district, state, dob } = attributes;

  // Use uuid as the primary identifier, fallback to nameID
  const samlIdentifier = uuid || nameID;

  // Build full name from firstName + lastName if not provided
  const athleteFullName = fullName || [firstName, lastName].filter(Boolean).join(' ') || screenName || 'SAML User';

  // First, try to find existing athlete by SAML nameID (which stores the uuid)
  let result = await query(
    'SELECT * FROM athletes WHERE saml_name_id = ?',
    [samlIdentifier]
  );

  if (result.rows.length > 0) {
    logger.info(`Found existing athlete by SAML uuid: ${samlIdentifier}`);

    // Update athlete info if IDP provides updated data
    if (email || athleteFullName !== 'SAML User') {
      await query(
        `UPDATE athletes SET
          full_name = COALESCE(?, full_name),
          email = COALESCE(?, email),
          updated_at = datetime('now')
        WHERE saml_name_id = ?`,
        [athleteFullName !== 'SAML User' ? athleteFullName : null, email || null, samlIdentifier]
      );
    }

    return result.rows[0];
  }

  // Try to find by email if provided
  if (email) {
    result = await query(
      'SELECT * FROM athletes WHERE email = ?',
      [email]
    );

    if (result.rows.length > 0) {
      // Link existing account with SAML
      await query(
        'UPDATE athletes SET saml_name_id = ?, saml_provider = ?, updated_at = datetime(\'now\') WHERE id = ?',
        [samlIdentifier, 'sports-idp', result.rows[0].id]
      );
      logger.info(`Linked existing athlete ${email} with SAML uuid: ${samlIdentifier}`);
      return result.rows[0];
    }
  }

  // Create new athlete from SAML data
  const athleteId = uuidv4();
  const athleteEmail = email || `${samlIdentifier}@saml.local`; // Fallback email if not provided

  await query(
    `INSERT INTO athletes (
      id, full_name, email, phone_number, dob, district, state,
      password_hash, saml_name_id, saml_provider, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      athleteId,
      athleteFullName,
      athleteEmail,
      phone || null,
      dob || null,
      district || null,
      state || null,
      '', // No password for SAML users
      samlIdentifier,
      'sports-idp'
    ]
  );

  logger.info(`Created new athlete from SAML: ${athleteEmail} (${athleteId}) with uuid: ${samlIdentifier}`);

  // Auto-map competition records for the new athlete
  try {
    if (athleteFullName && athleteFullName !== 'SAML User') {
      await query(`
        UPDATE athlete_competitions
        SET athlete_id = ?
        WHERE (athlete_id IS NULL OR athlete_id = '')
          AND LOWER(TRIM(full_name)) = LOWER(TRIM(?))
      `, [athleteId, athleteFullName]);
    }
  } catch (mappingError) {
    logger.error('Error auto-mapping competition records for SAML user:', mappingError);
  }

  // Return the newly created athlete
  const newAthlete = await query('SELECT * FROM athletes WHERE id = ?', [athleteId]);
  return newAthlete.rows[0];
}

// Debug endpoint to check SAML configuration (only in development)
router.get('/debug', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ message: 'Not available in production' });
  }

  const baseUrl = process.env.SAML_SP_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
  res.json({
    spEntityId: process.env.SAML_SP_ENTITY_ID || `${baseUrl}/api/saml/metadata`,
    acsUrl: `${baseUrl}/api/saml/acs`,
    idpEntryPoint: 'https://app6.creanttechnologies.com/c/portal/saml/sso',
    idpLogoutUrl: 'https://app6.creanttechnologies.com/c/portal/saml/slo',
    configuredBaseUrl: baseUrl,
    envSamlSpBaseUrl: process.env.SAML_SP_BASE_URL || '(not set)'
  });
});

export default router;
