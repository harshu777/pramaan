import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

interface SignatureOptions {
  privateKeyPath?: string;
  privateKeyPEM?: string;
  passphrase?: string;
  algorithm?: string;
}

interface VerificationOptions {
  publicKeyPath?: string;
  publicKeyPEM?: string;
  algorithm?: string;
}

class DigitalSignatureService {
  private algorithm: string = 'RSA-SHA256';

  /**
   * Generate a new RSA key pair for digital signatures
   */
  generateKeyPair(): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    return { publicKey, privateKey };
  }

  /**
   * Sign data using a private key
   */
  signData(data: string | Buffer, options: SignatureOptions): string {
    try {
      let privateKey: string;

      // Get private key from path or direct PEM
      if (options.privateKeyPath) {
        privateKey = fs.readFileSync(options.privateKeyPath, 'utf8');
      } else if (options.privateKeyPEM) {
        privateKey = options.privateKeyPEM;
      } else {
        // Use default private key from environment or config
        const defaultKeyPath = path.join(__dirname, '../../keys/private.pem');
        if (fs.existsSync(defaultKeyPath)) {
          privateKey = fs.readFileSync(defaultKeyPath, 'utf8');
        } else {
          throw new Error('No private key provided for signing');
        }
      }

      const sign = crypto.createSign(options.algorithm || this.algorithm);
      sign.update(data);
      sign.end();

      const signature = sign.sign({
        key: privateKey,
        passphrase: options.passphrase
      });

      return signature.toString('base64');
    } catch (error) {
      logger.error('Failed to sign data:', error);
      throw new Error('Digital signature generation failed');
    }
  }

  /**
   * Verify a signature using a public key
   */
  verifySignature(
    data: string | Buffer,
    signature: string,
    options: VerificationOptions
  ): boolean {
    try {
      let publicKey: string;

      // Get public key from path or direct PEM
      if (options.publicKeyPath) {
        publicKey = fs.readFileSync(options.publicKeyPath, 'utf8');
      } else if (options.publicKeyPEM) {
        publicKey = options.publicKeyPEM;
      } else {
        // Use default public key from environment or config
        const defaultKeyPath = path.join(__dirname, '../../keys/public.pem');
        if (fs.existsSync(defaultKeyPath)) {
          publicKey = fs.readFileSync(defaultKeyPath, 'utf8');
        } else {
          throw new Error('No public key provided for verification');
        }
      }

      const verify = crypto.createVerify(options.algorithm || this.algorithm);
      verify.update(data);
      verify.end();

      const signatureBuffer = Buffer.from(signature, 'base64');
      return verify.verify(publicKey, signatureBuffer);
    } catch (error) {
      logger.error('Failed to verify signature:', error);
      return false;
    }
  }

  /**
   * Sign a certificate object and return signature
   */
  async signCertificate(certificateData: any, options?: SignatureOptions): Promise<{
    signature: string;
    algorithm: string;
    timestamp: string;
  }> {
    try {
      // Canonicalize the certificate data to ensure consistent signing
      const canonicalData = this.canonicalizeJSON(certificateData);
      const dataString = JSON.stringify(canonicalData);

      const signature = this.signData(dataString, options || {});

      return {
        signature,
        algorithm: options?.algorithm || this.algorithm,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to sign certificate:', error);
      throw new Error('Certificate signing failed');
    }
  }

  /**
   * Verify a certificate signature
   */
  async verifyCertificateSignature(
    certificateData: any,
    signature: string,
    options?: VerificationOptions
  ): Promise<boolean> {
    try {
      // Canonicalize the certificate data for verification
      const canonicalData = this.canonicalizeJSON(certificateData);
      const dataString = JSON.stringify(canonicalData);

      return this.verifySignature(dataString, signature, options || {});
    } catch (error) {
      logger.error('Failed to verify certificate signature:', error);
      return false;
    }
  }

  /**
   * Generate a signature image/visual representation for PDFs
   */
  generateSignatureVisual(signerName: string, signerTitle: string, timestamp: string): {
    text: string;
    qrData?: string;
  } {
    const signatureText = `Digitally Signed by: ${signerName}
${signerTitle}
Date: ${timestamp}
Algorithm: ${this.algorithm}`;

    return {
      text: signatureText
    };
  }

  /**
   * Canonicalize JSON for consistent signing
   */
  private canonicalizeJSON(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.canonicalizeJSON(item));
    }

    const sortedKeys = Object.keys(obj).sort();
    const result: any = {};

    for (const key of sortedKeys) {
      result[key] = this.canonicalizeJSON(obj[key]);
    }

    return result;
  }

  /**
   * Initialize default keys if they don't exist
   */
  async initializeDefaultKeys(): Promise<void> {
    const keysDir = path.join(__dirname, '../../keys');
    const privateKeyPath = path.join(keysDir, 'private.pem');
    const publicKeyPath = path.join(keysDir, 'public.pem');

    // Create keys directory if it doesn't exist
    if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
    }

    // Generate keys if they don't exist
    if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
      logger.info('Generating default RSA key pair for digital signatures...');
      const { publicKey, privateKey } = this.generateKeyPair();

      fs.writeFileSync(privateKeyPath, privateKey, 'utf8');
      fs.writeFileSync(publicKeyPath, publicKey, 'utf8');

      logger.info('Default RSA key pair generated successfully');
    }
  }
}

export const digitalSignatureService = new DigitalSignatureService();