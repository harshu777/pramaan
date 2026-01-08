import { SAML, SamlConfig } from '@node-saml/node-saml';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

// Load SP private key and certificate for signing requests
let SP_PRIVATE_KEY = '';
let SP_CERTIFICATE = '';

try {
  const keyPath = path.join(__dirname, '../../saml-sp.key');
  const certPath = path.join(__dirname, '../../saml-sp.crt');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    SP_PRIVATE_KEY = fs.readFileSync(keyPath, 'utf8');
    SP_CERTIFICATE = fs.readFileSync(certPath, 'utf8');
    logger.info('SAML SP signing certificate loaded successfully');
  } else {
    logger.warn('SAML SP signing certificate not found - requests will not be signed');
  }
} catch (error) {
  logger.warn('Failed to load SAML SP signing certificate:', error);
}

// IDP Certificate extracted from SAML-metadata.xml
const IDP_CERTIFICATE = `MIICoTCCAYkCBgGbEYLApTANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDDAlTcG9ydHNJRFAwHhcN
MjUxMjEyMDc0MjE5WhcNMjYxMjAzMDc0MjE5WjAUMRIwEAYDVQQDDAlTcG9ydHNJRFAwggEiMA0G
CSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDVQnPWYB2ZbtGQPJ/OiNtSq2i9AXr9U6IIYrUPb6EJ
TBj64OoXW8sw+qwIbsXLHIicSsQYzhIXgjyiIV/NM/ixsiNHuX0+EOoQw/Fw1x1RfGqxaJ01qo87
vhkPsov1VcOLi8ItbRS7+OMB6PkDyQV4L+7Z/2AP4DRCxfDgyWY1UWo3cHcFnIOJfacmYvaJCgbf
qXOZDZBbMWt0b8LWxNkhWkvKJmMKuaSWjfXZXXX/ifEk/bWRy4NKxQ9mCXWJ/YSjEoYWIyxfnxfH
U2VLGXlj13qlTwq5OZbn1gHjwKKJfTXbg09LzQbsLCigcxdvAPbaTl9NVoJRnoEmKcZQ+VFPAgMB
AAEwDQYJKoZIhvcNAQELBQADggEBAG9je9OsLK+z2tjG/v9D+e4Tm++9R4dQQpCWlWk3Mkp6BSNZ
8FEEBxnKXrLQ2Wsuu+MTmEoVERpuhZJJSloGjn/dhpkYGeO+FHbn38tZhH4GLfWl6tFSVycgIA4n
UrVVkXCyt3N9TWyJ7UIekux2A7LyQ4kdQ6xz4HxeirujRC2Qbq1SCrrBJnPIPYfcLZGoYMFjxhRF
KyvRMmgTkzIwj0bjYT678IG26b5gnWIVQUxAsHfI4jj3RPNMTb6qk8+pAPfIp6Hi1mtJMP3LnNzU
esdOfFeHgfVzJGWDwVeMbCJG1PY3aMfz3VHA66t5YI7e2X0P+AePazXvNwd0hAq/q7U=`;

// Get the application base URL
const getBaseUrl = (): string => {
  return process.env.SAML_SP_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
};

// SAML Configuration
export const getSamlConfig = (): SamlConfig => {
  const baseUrl = getBaseUrl();

  return {
    // Service Provider (SP) Configuration
    issuer: process.env.SAML_SP_ENTITY_ID || `${baseUrl}/api/saml/metadata`,
    callbackUrl: `${baseUrl}/api/saml/acs`,

    // Identity Provider (IDP) Configuration
    entryPoint: 'https://app6.creanttechnologies.com/c/portal/saml/sso',
    logoutUrl: 'https://app6.creanttechnologies.com/c/portal/saml/slo',
    idpCert: IDP_CERTIFICATE,

    // Security settings
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',

    // Allow clock skew for assertion validation (5 minutes)
    acceptedClockSkewMs: 300000,

    // Attribute mapping - will be customized based on IDP response
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',

    // Request signing - IDP requires signed AuthnRequests
    authnRequestBinding: 'HTTP-POST',
    privateKey: SP_PRIVATE_KEY || undefined,
    decryptionPvk: SP_PRIVATE_KEY || undefined,
  };
};

// Create SAML instance
let samlInstance: SAML | null = null;

export const getSamlInstance = (): SAML => {
  if (!samlInstance) {
    samlInstance = new SAML(getSamlConfig());
  }
  return samlInstance;
};

// Extract certificate content (without headers)
const getCleanCertificate = (): string => {
  if (!SP_CERTIFICATE) return '';
  return SP_CERTIFICATE
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '');
};

// Generate SP metadata
export const generateSpMetadata = (): string => {
  const baseUrl = getBaseUrl();
  const entityId = process.env.SAML_SP_ENTITY_ID || `${baseUrl}/api/saml/metadata`;
  const acsUrl = `${baseUrl}/api/saml/acs`;
  const sloUrl = `${baseUrl}/api/saml/slo`;
  const cleanCert = getCleanCertificate();

  // Include KeyDescriptor only if we have a certificate
  const keyDescriptor = cleanCert ? `
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${cleanCert}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="${cleanCert ? 'true' : 'false'}" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">${keyDescriptor}
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified</md:NameIDFormat>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="0" isDefault="true"/>
    <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${sloUrl}"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
};

// Parse SAML response and extract user attributes
export interface SamlUserAttributes {
  nameID: string;
  nameIDFormat?: string;
  uuid?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  screenName?: string;
  phone?: string;
  district?: string;
  state?: string;
  dob?: string;
  [key: string]: string | undefined;
}

export const parseSamlAttributes = (profile: any): SamlUserAttributes => {
  // Log the raw profile structure for debugging
  logger.info('=== SAML PROFILE DEBUG START ===');
  logger.info('Profile type:', typeof profile);
  logger.info('Profile keys:', profile ? Object.keys(profile) : 'null');
  logger.info('Profile stringify:', JSON.stringify(profile, null, 2));
  if (profile?.attributes) {
    logger.info('Profile.attributes keys:', Object.keys(profile.attributes));
    logger.info('Profile.attributes stringify:', JSON.stringify(profile.attributes, null, 2));
  }
  logger.info('=== SAML PROFILE DEBUG END ===');

  // Helper to get clean string value (trim and handle empty)
  const cleanString = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = Array.isArray(val) ? val[0] : String(val);
    return str ? str.trim() : '';
  };

  // Get nameID - handle empty/whitespace as empty string
  const rawNameID = profile?.nameID || profile?.NameID || '';
  const nameID = cleanString(rawNameID);

  // Map common SAML attribute names to our format
  const attributes: SamlUserAttributes = {
    nameID: nameID,
    nameIDFormat: profile?.nameIDFormat || profile?.NameIDFormat,
  };

  // Attribute mappings - includes expected attributes from Sports Portal IDP
  // Primary attributes: uuid, firstName, lastName, emailAddress, screenName
  const attributeMappings: { [key: string]: string[] } = {
    uuid: ['uuid', 'UUID', 'userId', 'uid', 'urn:oid:0.9.2342.19200300.100.1.1'],
    email: ['emailAddress', 'email', 'Email', 'mail', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
    firstName: ['firstName', 'FirstName', 'givenName', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'],
    lastName: ['lastName', 'LastName', 'surname', 'sn', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'],
    screenName: ['screenName', 'ScreenName', 'displayName', 'username'],
    fullName: ['fullName', 'name', 'cn', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'],
    phone: ['phone', 'phoneNumber', 'mobile', 'telephoneNumber'],
    district: ['district', 'District'],
    state: ['state', 'State', 'st'],
    dob: ['dob', 'dateOfBirth', 'birthDate'],
  };

  // Helper function to extract value from profile or nested attributes
  const findAttributeValue = (possibleNames: string[]): string | undefined => {
    for (const name of possibleNames) {
      let val: any;

      // Check directly on profile
      val = profile?.[name];
      if (val !== undefined && val !== null && val !== '') {
        const cleaned = cleanString(val);
        if (cleaned) {
          logger.info(`Found attribute '${name}' directly on profile: ${cleaned}`);
          return cleaned;
        }
      }

      // Check in profile.attributes (node-saml sometimes nests attributes here)
      val = profile?.attributes?.[name];
      if (val !== undefined && val !== null && val !== '') {
        const cleaned = cleanString(val);
        if (cleaned) {
          logger.info(`Found attribute '${name}' in profile.attributes: ${cleaned}`);
          return cleaned;
        }
      }

      // Check all keys of profile for case-insensitive match
      if (profile) {
        for (const key of Object.keys(profile)) {
          if (key.toLowerCase() === name.toLowerCase()) {
            val = profile[key];
            if (val !== undefined && val !== null && val !== '') {
              const cleaned = cleanString(val);
              if (cleaned) {
                logger.info(`Found attribute '${name}' (case-insensitive as '${key}') on profile: ${cleaned}`);
                return cleaned;
              }
            }
          }
        }
      }

      // Check all keys of profile.attributes for case-insensitive match
      if (profile?.attributes) {
        for (const key of Object.keys(profile.attributes)) {
          if (key.toLowerCase() === name.toLowerCase()) {
            val = profile.attributes[key];
            if (val !== undefined && val !== null && val !== '') {
              const cleaned = cleanString(val);
              if (cleaned) {
                logger.info(`Found attribute '${name}' (case-insensitive as '${key}') in profile.attributes: ${cleaned}`);
                return cleaned;
              }
            }
          }
        }
      }
    }
    return undefined;
  };

  // Extract attributes from profile
  for (const [key, possibleNames] of Object.entries(attributeMappings)) {
    const value = findAttributeValue(possibleNames);
    if (value) {
      attributes[key] = value;
    }
  }

  // If fullName is not set but firstName/lastName are, combine them
  if (!attributes.fullName && (attributes.firstName || attributes.lastName)) {
    attributes.fullName = [attributes.firstName, attributes.lastName].filter(Boolean).join(' ');
  }

  // If email is not set but nameID looks like an email, use it
  if (!attributes.email && attributes.nameID && attributes.nameID.includes('@')) {
    attributes.email = attributes.nameID;
  }

  // If uuid is not set, use nameID as fallback, or email/screenName if nameID is empty
  if (!attributes.uuid) {
    attributes.uuid = attributes.nameID || attributes.email || attributes.screenName || '';
  }

  // If nameID is empty, use email or screenName as identifier
  if (!attributes.nameID) {
    attributes.nameID = attributes.email || attributes.screenName || attributes.uuid || '';
    logger.info('NameID was empty, using fallback identifier:', attributes.nameID);
  }

  // Log all available profile data for debugging
  logger.info('Raw SAML profile structure:', {
    hasAttributes: !!profile.attributes,
    attributesKeys: profile.attributes ? Object.keys(profile.attributes) : [],
    profileKeys: Object.keys(profile),
    nameID: profile.nameID,
    emailAddress: profile.emailAddress,
    'profile.attributes?.emailAddress': profile.attributes?.emailAddress
  });

  logger.info('Parsed SAML attributes:', {
    nameID: attributes.nameID,
    uuid: attributes.uuid,
    email: attributes.email,
    firstName: attributes.firstName,
    lastName: attributes.lastName,
    fullName: attributes.fullName,
    screenName: attributes.screenName
  });

  return attributes;
};

export default {
  getSamlConfig,
  getSamlInstance,
  generateSpMetadata,
  parseSamlAttributes,
};
