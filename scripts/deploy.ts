import { ethers } from "hardhat";

async function main() {
  console.log("Deploying CertificateRegistry contract...");

  // Get the contract factory
  const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");

  // Deploy the contract
  const certificateRegistry = await CertificateRegistry.deploy();

  // Wait for deployment
  await certificateRegistry.waitForDeployment();

  // Get the deployed address
  const address = await certificateRegistry.getAddress();

  console.log("CertificateRegistry deployed to:", address);

  // Get the deployer address
  const [deployer] = await ethers.getSigners();
  console.log("Deployed by:", deployer.address);

  // Authorize the deployer as an issuer
  const tx = await certificateRegistry.authorizeIssuer(
    deployer.address,
    "Default Issuer",
    "did:example:123456789"
  );
  await tx.wait();

  console.log("Deployer authorized as issuer");

  return address;
}

main()
  .then((address) => {
    console.log("\n✅ Deployment successful!");
    console.log("Contract address:", address);
    console.log("\nAdd this to your .env file:");
    console.log(`CONTRACT_ADDRESS=${address}`);
    console.log(`PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
