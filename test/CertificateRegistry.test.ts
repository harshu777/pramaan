import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("CertificateRegistry", function () {
  async function deployCertificateRegistryFixture() {
    const [owner, issuer1, issuer2, otherAccount] = await ethers.getSigners();

    const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
    const certificateRegistry = await CertificateRegistry.deploy();

    return { certificateRegistry, owner, issuer1, issuer2, otherAccount };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { certificateRegistry, owner } = await loadFixture(deployCertificateRegistryFixture);
      expect(await certificateRegistry.owner()).to.equal(owner.address);
    });
  });

  describe("Issuer Management", function () {
    it("Should authorize an issuer", async function () {
      const { certificateRegistry, owner, issuer1 } = await loadFixture(deployCertificateRegistryFixture);

      await expect(certificateRegistry.authorizeIssuer(
        issuer1.address,
        "Test University",
        "did:example:university"
      )).to.emit(certificateRegistry, "IssuerAuthorized")
        .withArgs(issuer1.address, "Test University", "did:example:university");

      const issuerData = await certificateRegistry.issuers(issuer1.address);
      expect(issuerData.isAuthorized).to.be.true;
      expect(issuerData.name).to.equal("Test University");
    });

    it("Should deauthorize an issuer", async function () {
      const { certificateRegistry, owner, issuer1 } = await loadFixture(deployCertificateRegistryFixture);

      await certificateRegistry.authorizeIssuer(
        issuer1.address,
        "Test University",
        "did:example:university"
      );

      await expect(certificateRegistry.deauthorizeIssuer(issuer1.address))
        .to.emit(certificateRegistry, "IssuerDeauthorized")
        .withArgs(issuer1.address);

      const issuerData = await certificateRegistry.issuers(issuer1.address);
      expect(issuerData.isAuthorized).to.be.false;
    });

    it("Should prevent non-owner from authorizing issuers", async function () {
      const { certificateRegistry, issuer1, otherAccount } = await loadFixture(deployCertificateRegistryFixture);

      await expect(
        certificateRegistry.connect(otherAccount).authorizeIssuer(
          issuer1.address,
          "Test University",
          "did:example:university"
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Certificate Issuance", function () {
    it("Should issue a certificate", async function () {
      const { certificateRegistry, owner, issuer1 } = await loadFixture(deployCertificateRegistryFixture);

      await certificateRegistry.authorizeIssuer(
        issuer1.address,
        "Test University",
        "did:example:university"
      );

      const certHash = ethers.id("certificate123");
      const ipfsCid = "QmTest123";
      const expiryDate = Math.floor(Date.now() / 1000) + 86400; // 1 day from now

      await expect(
        certificateRegistry.connect(issuer1).issueCertificate(certHash, ipfsCid, expiryDate)
      ).to.emit(certificateRegistry, "CertificateIssued");

      const certificate = await certificateRegistry.getCertificate(certHash);
      expect(certificate.ipfsCid).to.equal(ipfsCid);
      expect(certificate.issuer).to.equal(issuer1.address);
      expect(certificate.isCancelled).to.be.false;
    });

    it("Should prevent non-authorized issuer from issuing certificates", async function () {
      const { certificateRegistry, otherAccount } = await loadFixture(deployCertificateRegistryFixture);

      const certHash = ethers.id("certificate123");
      const ipfsCid = "QmTest123";
      const expiryDate = 0;

      await expect(
        certificateRegistry.connect(otherAccount).issueCertificate(certHash, ipfsCid, expiryDate)
      ).to.be.revertedWith("Not an authorized issuer");
    });

    it("Should prevent duplicate certificate issuance", async function () {
      const { certificateRegistry, owner, issuer1 } = await loadFixture(deployCertificateRegistryFixture);

      await certificateRegistry.authorizeIssuer(
        issuer1.address,
        "Test University",
        "did:example:university"
      );

      const certHash = ethers.id("certificate123");
      const ipfsCid = "QmTest123";
      const expiryDate = 0;

      await certificateRegistry.connect(issuer1).issueCertificate(certHash, ipfsCid, expiryDate);

      await expect(
        certificateRegistry.connect(issuer1).issueCertificate(certHash, ipfsCid, expiryDate)
      ).to.be.revertedWith("Certificate already exists");
    });
  });

  describe("Certificate Cancellation", function () {
    it("Should allow issuer to cancel their certificate", async function () {
      const { certificateRegistry, owner, issuer1 } = await loadFixture(deployCertificateRegistryFixture);

      await certificateRegistry.authorizeIssuer(
        issuer1.address,
        "Test University",
        "did:example:university"
      );

      const certHash = ethers.id("certificate123");
      const ipfsCid = "QmTest123";

      await certificateRegistry.connect(issuer1).issueCertificate(certHash, ipfsCid, 0);

      await expect(
        certificateRegistry.connect(issuer1).cancelCertificate(certHash, "Test cancellation")
      ).to.emit(certificateRegistry, "CertificateCancelled");

      const certificate = await certificateRegistry.getCertificate(certHash);
      expect(certificate.isCancelled).to.be.true;
    });

    it("Should allow owner to cancel any certificate", async function () {
      const { certificateRegistry, owner, issuer1 } = await loadFixture(deployCertificateRegistryFixture);

      await certificateRegistry.authorizeIssuer(
        issuer1.address,
        "Test University",
        "did:example:university"
      );

      const certHash = ethers.id("certificate123");
      const ipfsCid = "QmTest123";

      await certificateRegistry.connect(issuer1).issueCertificate(certHash, ipfsCid, 0);

      await expect(
        certificateRegistry.cancelCertificate(certHash, "Admin cancellation")
      ).to.emit(certificateRegistry, "CertificateCancelled");
    });

    it("Should prevent others from cancelling certificates", async function () {
      const { certificateRegistry, owner, issuer1, otherAccount } = await loadFixture(deployCertificateRegistryFixture);

      await certificateRegistry.authorizeIssuer(
        issuer1.address,
        "Test University",
        "did:example:university"
      );

      const certHash = ethers.id("certificate123");
      const ipfsCid = "QmTest123";

      await certificateRegistry.connect(issuer1).issueCertificate(certHash, ipfsCid, 0);

      await expect(
        certificateRegistry.connect(otherAccount).cancelCertificate(certHash, "Unauthorized cancellation")
      ).to.be.revertedWith("Only issuer or owner can cancel");
    });
  });

  describe("Certificate Verification", function () {
    it("Should verify valid certificate", async function () {
      const { certificateRegistry, owner, issuer1 } = await loadFixture(deployCertificateRegistryFixture);

      await certificateRegistry.authorizeIssuer(
        issuer1.address,
        "Test University",
        "did:example:university"
      );

      const certHash = ethers.id("certificate123");
      const ipfsCid = "QmTest123";
      const expiryDate = Math.floor(Date.now() / 1000) + 86400; // 1 day from now

      await certificateRegistry.connect(issuer1).issueCertificate(certHash, ipfsCid, expiryDate);

      const verification = await certificateRegistry.verifyCertificate(certHash);

      expect(verification.isValid).to.be.true;
      expect(verification.ipfsCid).to.equal(ipfsCid);
      expect(verification.issuer).to.equal(issuer1.address);
      expect(verification.isExpired).to.be.false;
      expect(verification.isCancelled).to.be.false;
    });

    it("Should detect expired certificate", async function () {
      const { certificateRegistry, owner, issuer1 } = await loadFixture(deployCertificateRegistryFixture);

      await certificateRegistry.authorizeIssuer(
        issuer1.address,
        "Test University",
        "did:example:university"
      );

      const certHash = ethers.id("certificate123");
      const ipfsCid = "QmTest123";
      const expiryDate = Math.floor(Date.now() / 1000) - 86400; // Already expired

      await certificateRegistry.connect(issuer1).issueCertificate(certHash, ipfsCid, expiryDate);

      const verification = await certificateRegistry.verifyCertificate(certHash);

      expect(verification.isValid).to.be.false;
      expect(verification.isExpired).to.be.true;
    });

    it("Should detect cancelled certificate", async function () {
      const { certificateRegistry, owner, issuer1 } = await loadFixture(deployCertificateRegistryFixture);

      await certificateRegistry.authorizeIssuer(
        issuer1.address,
        "Test University",
        "did:example:university"
      );

      const certHash = ethers.id("certificate123");
      const ipfsCid = "QmTest123";

      await certificateRegistry.connect(issuer1).issueCertificate(certHash, ipfsCid, 0);
      await certificateRegistry.connect(issuer1).cancelCertificate(certHash, "Test");

      const verification = await certificateRegistry.verifyCertificate(certHash);

      expect(verification.isValid).to.be.false;
      expect(verification.isCancelled).to.be.true;
    });
  });

  describe("Pausable", function () {
    it("Should pause and unpause contract", async function () {
      const { certificateRegistry, owner, issuer1 } = await loadFixture(deployCertificateRegistryFixture);

      await certificateRegistry.authorizeIssuer(
        issuer1.address,
        "Test University",
        "did:example:university"
      );

      await certificateRegistry.pause();

      const certHash = ethers.id("certificate123");
      const ipfsCid = "QmTest123";

      await expect(
        certificateRegistry.connect(issuer1).issueCertificate(certHash, ipfsCid, 0)
      ).to.be.revertedWith("Pausable: paused");

      await certificateRegistry.unpause();

      await expect(
        certificateRegistry.connect(issuer1).issueCertificate(certHash, ipfsCid, 0)
      ).to.emit(certificateRegistry, "CertificateIssued");
    });
  });
});