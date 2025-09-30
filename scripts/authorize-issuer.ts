import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const issuerAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
  const registry = CertificateRegistry.attach(contractAddress);

  console.log("Authorizing issuer...");
  const tx = await registry.authorizeIssuer(
    issuerAddress,
    "Test University",
    "did:example:testuser"
  );

  await tx.wait();
  console.log("Issuer authorized successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });