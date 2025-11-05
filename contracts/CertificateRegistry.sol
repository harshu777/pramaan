// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CertificateRegistry is Ownable, Pausable, ReentrancyGuard {

    struct Certificate {
        bytes32 certHash;
        string ipfsCid;
        address issuer;
        uint256 issuedAt;
        uint256 expiryDate;
        bool isCancelled;
        string issuerDid;
    }

    struct Issuer {
        string name;
        string did;
        bool isAuthorized;
        uint256 certificatesIssued;
    }

    // Mappings
    mapping(bytes32 => Certificate) public certificates;
    mapping(address => Issuer) public issuers;
    mapping(bytes32 => bool) public certificateExists;
    mapping(bytes32 => string) public cancellationReasons;

    // Arrays for enumeration
    bytes32[] public certificateHashes;
    address[] public authorizedIssuers;

    // Events
    event CertificateIssued(
        bytes32 indexed certHash,
        string ipfsCid,
        address indexed issuer,
        string issuerDid,
        uint256 issuedAt,
        uint256 expiryDate
    );

    event CertificateCancelled(
        bytes32 indexed certHash,
        address indexed cancelledBy,
        string reason,
        uint256 cancelledAt
    );

    event IssuerAuthorized(
        address indexed issuerAddress,
        string name,
        string did
    );

    event IssuerDeauthorized(
        address indexed issuerAddress
    );

    // Modifiers
    modifier onlyAuthorizedIssuer() {
        require(issuers[msg.sender].isAuthorized, "Not an authorized issuer");
        _;
    }

    modifier certificateNotExists(bytes32 _certHash) {
        require(!certificateExists[_certHash], "Certificate already exists");
        _;
    }

    modifier certificateMustExist(bytes32 _certHash) {
        require(certificateExists[_certHash], "Certificate does not exist");
        _;
    }

    constructor() Ownable(msg.sender) {
        // Constructor sets the deployer as the initial owner
    }

    /**
     * @dev Issue a new certificate
     * @param _certHash Hash of the certificate
     * @param _ipfsCid IPFS CID where certificate is stored
     * @param _expiryDate Expiry timestamp (0 for no expiry)
     */
    function issueCertificate(
        bytes32 _certHash,
        string memory _ipfsCid,
        uint256 _expiryDate
    ) external onlyAuthorizedIssuer certificateNotExists(_certHash) whenNotPaused nonReentrant {
        require(bytes(_ipfsCid).length > 0, "IPFS CID cannot be empty");
        require(_expiryDate == 0 || _expiryDate > block.timestamp, "Invalid expiry date");

        Certificate memory newCert = Certificate({
            certHash: _certHash,
            ipfsCid: _ipfsCid,
            issuer: msg.sender,
            issuedAt: block.timestamp,
            expiryDate: _expiryDate,
            isCancelled: false,
            issuerDid: issuers[msg.sender].did
        });

        certificates[_certHash] = newCert;
        certificateExists[_certHash] = true;
        certificateHashes.push(_certHash);
        issuers[msg.sender].certificatesIssued++;

        emit CertificateIssued(
            _certHash,
            _ipfsCid,
            msg.sender,
            issuers[msg.sender].did,
            block.timestamp,
            _expiryDate
        );
    }

    /**
     * @dev Cancel a certificate
     * @param _certHash Hash of the certificate to cancel
     * @param _reason Reason for cancellation
     */
    function cancelCertificate(
        bytes32 _certHash,
        string memory _reason
    ) external certificateMustExist(_certHash) whenNotPaused {
        Certificate storage cert = certificates[_certHash];

        // Only issuer or owner can cancel
        require(
            msg.sender == cert.issuer || msg.sender == owner(),
            "Only issuer or owner can cancel"
        );
        require(!cert.isCancelled, "Certificate already cancelled");

        cert.isCancelled = true;
        cancellationReasons[_certHash] = _reason;

        emit CertificateCancelled(_certHash, msg.sender, _reason, block.timestamp);
    }

    /**
     * @dev Verify a certificate
     * @param _certHash Hash of the certificate
     * @return isValid Whether the certificate is valid
     * @return ipfsCid IPFS CID of the certificate
     * @return issuer Address of the issuer
     * @return issuedAt Timestamp when issued
     * @return isExpired Whether the certificate has expired
     * @return isCancelled Whether the certificate is cancelled
     */
    function verifyCertificate(bytes32 _certHash)
        external
        view
        certificateMustExist(_certHash)
        returns (
            bool isValid,
            string memory ipfsCid,
            address issuer,
            uint256 issuedAt,
            bool isExpired,
            bool isCancelled
        )
    {
        Certificate memory cert = certificates[_certHash];

        isExpired = cert.expiryDate > 0 && cert.expiryDate < block.timestamp;
        isValid = !cert.isCancelled && !isExpired;

        return (
            isValid,
            cert.ipfsCid,
            cert.issuer,
            cert.issuedAt,
            isExpired,
            cert.isCancelled
        );
    }

    /**
     * @dev Authorize a new issuer
     * @param _issuerAddress Address of the issuer
     * @param _name Name of the issuer
     * @param _did DID of the issuer
     */
    function authorizeIssuer(
        address _issuerAddress,
        string memory _name,
        string memory _did
    ) external onlyOwner {
        require(_issuerAddress != address(0), "Invalid address");
        require(!issuers[_issuerAddress].isAuthorized, "Already authorized");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_did).length > 0, "DID cannot be empty");

        issuers[_issuerAddress] = Issuer({
            name: _name,
            did: _did,
            isAuthorized: true,
            certificatesIssued: 0
        });

        authorizedIssuers.push(_issuerAddress);

        emit IssuerAuthorized(_issuerAddress, _name, _did);
    }

    /**
     * @dev Deauthorize an issuer
     * @param _issuerAddress Address of the issuer to deauthorize
     */
    function deauthorizeIssuer(address _issuerAddress) external onlyOwner {
        require(issuers[_issuerAddress].isAuthorized, "Not authorized");

        issuers[_issuerAddress].isAuthorized = false;

        // Remove from authorized issuers array
        for (uint i = 0; i < authorizedIssuers.length; i++) {
            if (authorizedIssuers[i] == _issuerAddress) {
                authorizedIssuers[i] = authorizedIssuers[authorizedIssuers.length - 1];
                authorizedIssuers.pop();
                break;
            }
        }

        emit IssuerDeauthorized(_issuerAddress);
    }

    /**
     * @dev Get certificate details
     * @param _certHash Hash of the certificate
     */
    function getCertificate(bytes32 _certHash)
        external
        view
        certificateMustExist(_certHash)
        returns (Certificate memory)
    {
        return certificates[_certHash];
    }

    /**
     * @dev Get total number of certificates
     */
    function getTotalCertificates() external view returns (uint256) {
        return certificateHashes.length;
    }

    /**
     * @dev Get all authorized issuers
     */
    function getAuthorizedIssuers() external view returns (address[] memory) {
        return authorizedIssuers;
    }

    /**
     * @dev Pause contract (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}