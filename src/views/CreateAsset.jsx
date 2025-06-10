import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import AssetMetadataForm from '../components/AssetMetadataForm';
import AssetImageGenerator from '../components/AssetImageGenerator';
import { uploadToPinata, uploadMetadataToPinata } from '../utils/ipfsUtils.js';
import NFT_ABI from '../abis/NFT.json';
import config from '../config.js';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { Buffer } from 'buffer';

// Make Buffer available globally for keccak256
window.Buffer = Buffer;

function CreateAsset() {
  const [metadata, setMetadata] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mintStatus, setMintStatus] = useState({ status: '', message: '' });
  const [showPreview, setShowPreview] = useState(false);
  
  // Add whitelist state
  const [account, setAccount] = useState(null);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [whitelistOnly, setWhitelistOnly] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [nftContract, setNftContract] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  // Add this function to help users switch accounts
  const switchToOwnerAccount = async () => {
    try {
      setMintStatus({ status: 'loading', message: 'Please switch to the owner account in your wallet...' });
      
      // This will prompt the user to switch accounts in their wallet
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
      
      // After switching, refresh the page to update all states
      window.location.reload();
    } catch (error) {
      console.error("Error switching accounts:", error);
      setMintStatus({ 
        status: 'error', 
        message: 'Failed to switch accounts. Please manually switch to the owner account in your wallet.' 
      });
    }
  };

  // Check whitelist status on component mount
  useEffect(() => {
    const checkWhitelistStatus = async () => {
      try {
        // Get provider and account
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = provider.getSigner();
        const userAccount = await signer.getAddress();
        setAccount(userAccount);

        // Get NFT contract instance
        const nft = new ethers.Contract(config[31337].nft.address, NFT_ABI, provider);
        setNftContract(nft);

        // Check if user is owner
        try {
          const owner = await nft.owner();
          const ownerStatus = owner.toLowerCase() === userAccount.toLowerCase();
          setIsOwner(ownerStatus);
          console.log("User is owner:", ownerStatus);
        } catch (ownerError) {
          console.error("Error checking owner status:", ownerError);
          setIsOwner(false);
        }

        // Check if whitelist is required - handle potential missing function
        let whitelistRequired = true; // Default to true for security
        try {
          whitelistRequired = await nft.whitelistOnly();
        } catch (whitelistError) {
          console.log("Contract might not have whitelistOnly function, using default:", whitelistError);
        }
        setWhitelistOnly(whitelistRequired);
        
        if (whitelistRequired) {
          // Get stored whitelist from localStorage
          const storedAddresses = JSON.parse(localStorage.getItem('whitelistedAddresses') || '[]');
          
          if (storedAddresses.includes(userAccount)) {
            // Generate merkle proof
            const leaves = storedAddresses.map(addr => 
              keccak256(Buffer.from(addr.slice(2), 'hex'))
            );
            
            const merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
            const leaf = keccak256(Buffer.from(userAccount.slice(2), 'hex'));
            const proof = merkleTree.getHexProof(leaf);
            
            // Verify whitelist status
            try {
              const whitelistStatus = await nft.isWhitelisted(userAccount, proof);
              setIsWhitelisted(whitelistStatus);
            } catch (error) {
              console.error("Error checking whitelist status with proof:", error);
              setIsWhitelisted(false);
            }
          } else {
            // Check if user is owner (owners are always allowed)
            try {
              const owner = await nft.owner();
              if (owner.toLowerCase() === userAccount.toLowerCase()) {
                setIsWhitelisted(true);
              } else {
                setIsWhitelisted(false);
              }
            } catch (error) {
              console.error("Error checking owner:", error);
              setIsWhitelisted(false);
            }
          }
        } else {
          // If whitelist is not required, consider everyone "whitelisted"
          setIsWhitelisted(true);
        }
      } catch (error) {
        console.error("Error checking whitelist status:", error);
        setIsWhitelisted(false);
        setIsOwner(false);
      }
      
      setIsLoading(false);
    };

    checkWhitelistStatus();
  }, []);

  const handleMetadataSubmit = async (formData) => {
    setIsSubmitting(true);
    setMetadata(formData);
    setIsSubmitting(false);
    setShowPreview(true); // Show preview after metadata is submitted
  };

  const handleImageGenerated = (imageDataUrl) => {
    setGeneratedImage(imageDataUrl);
  };

  const handleDownloadImage = () => {
    if (!generatedImage) return;
    
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `asset-${metadata.basic.assetId || 'document'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const requestWhitelist = async () => {
    if (!nftContract || !account) return;
    
    setMintStatus({ status: 'loading', message: 'Checking ownership status...' });
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // Check if user is owner
      const owner = await nftContract.owner();
      const isOwner = owner.toLowerCase() === account.toLowerCase();
      
      if (!isOwner) {
        setMintStatus({ 
          status: 'error', 
          message: 'Only the contract owner can whitelist themselves. Please use the contract owner account.' 
        });
        return;
      }
      
      // Owner is whitelisting themselves
      setMintStatus({ status: 'loading', message: 'Adding yourself to whitelist...' });
      
      // Create a new merkle tree with just the owner's address
      const leaf = keccak256(Buffer.from(account.slice(2), 'hex'));
      const leaves = [leaf];
      const merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      const root = merkleTree.getHexRoot();
      
      console.log("Generated merkle root:", root);
      console.log("For owner address:", account);
      
      // Set the new merkle root
      const transaction = await nftContract.connect(signer).setMerkleRoot(root, {
        gasLimit: 100000
      });
      await transaction.wait();
      
      // Store the whitelist in localStorage
      localStorage.setItem('whitelistedAddresses', JSON.stringify([account]));
      console.log("Stored whitelisted addresses in localStorage:", [account]);
      
      setMintStatus({ 
        status: 'success', 
        message: 'Successfully added yourself to whitelist! You can now create and mint assets.' 
      });
      
      setIsWhitelisted(true);
      
      // Try to disable whitelist requirement for others
      try {
        const disableWhitelistTx = await nftContract.connect(signer).setWhitelistOnly(false, {
          gasLimit: 100000
        });
        await disableWhitelistTx.wait();
        
        setWhitelistOnly(false);
        setMintStatus({ 
          status: 'success', 
          message: 'Successfully added yourself to whitelist and disabled whitelist requirement for others!' 
        });
      } catch (whitelistError) {
        console.log("Could not disable whitelist requirement:", whitelistError);
        // Continue with just the owner being whitelisted
      }
      
      // Verify the whitelist status after setting it
      try {
        const proof = merkleTree.getHexProof(leaf);
        const verificationResult = await nftContract.isWhitelisted(account, proof);
        console.log("Verification after whitelisting:", verificationResult);
        
        if (!verificationResult) {
          console.warn("Whitelist verification failed after setting merkle root");
        }
      } catch (verifyError) {
        console.error("Error verifying whitelist status after setting:", verifyError);
      }
    } catch (error) {
      console.error("Error in whitelist request:", error);
      setMintStatus({ 
        status: 'error', 
        message: `Whitelist request failed: ${error.message}` 
      });
    }
  };

  const createAndMintAsset = async () => {
    if (!metadata) {
      setMintStatus({ 
        status: 'error', 
        message: 'Please complete the asset metadata form first' 
      });
      return;
    }

    setMintStatus({ status: 'loading', message: 'Generating asset document...' });
    
    // Wait for image generation if not already done
    if (!generatedImage) {
      setMintStatus({ 
        status: 'error', 
        message: 'Image generation in progress. Please wait...' 
      });
      return;
    }

    // Proceed with minting
    await mintAssetNFT();
  };

  const mintAssetNFT = async () => {
    if (!generatedImage || !metadata) {
      setMintStatus({ 
        status: 'error', 
        message: 'No image or metadata available to mint' 
      });
      return;
    }

    setMintStatus({ status: 'loading', message: 'Preparing to mint NFT...' });

    try {
      // Get provider and signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const account = await signer.getAddress();

      // Get NFT contract instance
      const nft = new ethers.Contract(config[31337].nft.address, NFT_ABI, signer);

      // 1. Upload image to Pinata
      setMintStatus({ status: 'loading', message: 'Uploading image to Pinata...' });
      
      // Convert data URL to Blob
      const imageBlob = await (await fetch(generatedImage)).blob();
      const assetName = metadata.basic.title || 'Asset Document';
      const assetId = metadata.basic.assetId || Date.now().toString();
      
      const { ipfsHash: imageIpfsHash } = await uploadToPinata(
        imageBlob, 
        `asset-${assetId}.png`
      );
      
      const imageIpfsUrl = `ipfs://${imageIpfsHash}`;
      
      // 2. Create and upload metadata JSON
      setMintStatus({ status: 'loading', message: 'Creating metadata...' });
      
      const metadataJSON = {
        name: assetName,
        description: metadata.basic.description || 'Asset document created on GCOMS',
        image: imageIpfsUrl,
        attributes: [
          { trait_type: 'Asset Type', value: metadata.basic.assetType },
          { trait_type: 'Asset ID', value: assetId },
          { trait_type: 'Owner', value: metadata.ownership.ownerName },
          { trait_type: 'Value', value: `${metadata.value.estimatedValue} ${metadata.value.currency}` },
          { trait_type: 'Valuation Date', value: metadata.value.valuationDate },
          { trait_type: 'Ownership Percentage', value: metadata.ownership.ownershipPercentage }
        ]
      };
      
      const { ipfsHash: metadataIpfsHash } = await uploadMetadataToPinata(
        metadataJSON, 
        `metadata-${assetId}.json`
      );
      
      // 3. Mint NFT with metadata reference
      setMintStatus({ status: 'loading', message: 'Minting NFT...' });
      
      // Check if whitelist is required
      const whitelistRequired = await nft.whitelistOnly();
      let merkleProof = [];
      
      if (whitelistRequired) {
        // Get stored whitelist from localStorage
        const storedAddresses = JSON.parse(localStorage.getItem('whitelistedAddresses') || '[]');
        
        if (storedAddresses.includes(account)) {
          // Generate merkle proof
          const leaves = storedAddresses.map(addr => 
            keccak256(Buffer.from(addr.slice(2), 'hex'))
          );
          
          // Create Merkle Tree
          const merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
          
          // Create leaf for the address
          const leaf = keccak256(Buffer.from(account.slice(2), 'hex'));
          
          // Generate proof
          merkleProof = merkleTree.getHexProof(leaf);
        } else {
          throw new Error('Your address is not whitelisted. Please request whitelist access first.');
        }
      }
      
      // Call mint function with merkle proof
      const cost = await nft.cost();
      const mintTx = await nft.mint(1, merkleProof, {
        value: cost,
        gasLimit: 500000
      });
      
      setMintStatus({ status: 'loading', message: 'Transaction submitted. Waiting for confirmation...' });
      
      await mintTx.wait();
      
      setMintStatus({ 
        status: 'success', 
        message: 'NFT minted successfully! Your asset is now on the blockchain.' 
      });
      
    } catch (error) {
      console.error("Error minting NFT:", error);
      setMintStatus({ 
        status: 'error', 
        message: `Failed to mint NFT: ${error.message || 'Unknown error'}` 
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6">Create New Asset</h2>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6">Create New Asset</h2>
      
      {whitelistOnly && !isWhitelisted ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Your address is not whitelisted. You need to be whitelisted to create and mint assets.
              </p>
              <div className="mt-2">
                <p className="text-sm text-yellow-700">
                  <strong>Current status:</strong> {isOwner ? 'You are the contract owner' : 'You are not the contract owner'}
                </p>
              </div>
              <div className="mt-4 flex space-x-4">
                {isOwner ? (
                  <button
                    onClick={requestWhitelist}
                    className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                  >
                    Request Whitelist Access
                  </button>
                ) : (
                  <button
                    onClick={switchToOwnerAccount}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Switch to Owner Account
                  </button>
                )}
              </div>
              {mintStatus.message && (
                <div className={`mt-4 p-3 rounded ${
                  mintStatus.status === 'success' ? 'bg-green-100 text-green-800' :
                  mintStatus.status === 'error' ? 'bg-red-100 text-red-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {mintStatus.message}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {!showPreview ? (
            <AssetMetadataForm 
              onMetadataSubmit={handleMetadataSubmit}
              isSubmitting={isSubmitting}
            />
          ) : (
            <>
              <div className="mb-4 flex justify-between items-center">
                <h3 className="text-lg font-medium">Asset Preview</h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Back to Form
                </button>
              </div>
              
              <AssetImageGenerator 
                metadata={metadata}
                onImageGenerated={handleImageGenerated}
              />
              
              {generatedImage && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-4">Generated Asset Document</h3>
                  <img 
                    src={generatedImage} 
                    alt="Generated Asset Document" 
                    className="border rounded shadow-sm max-w-full h-auto"
                  />
                  <div className="mt-4 flex flex-wrap gap-4">
                    <button
                      onClick={handleDownloadImage}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Download Document
                    </button>
                    <button
                      onClick={mintAssetNFT}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                      disabled={mintStatus.status === 'loading'}
                    >
                      {mintStatus.status === 'loading' ? 'Processing...' : 'Mint as NFT'}
                    </button>
                    <button
                      onClick={createAndMintAsset}
                      className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                      disabled={mintStatus.status === 'loading'}
                    >
                      {mintStatus.status === 'loading' ? 'Processing...' : 'Create and Mint'}
                    </button>
                  </div>
                  
                  {mintStatus.message && (
                    <div className={`mt-4 p-3 rounded ${
                      mintStatus.status === 'success' ? 'bg-green-100 text-green-800' :
                      mintStatus.status === 'error' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {mintStatus.message}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default CreateAsset;
