import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import AssetMetadataForm from './AssetMetadataForm';
import AssetImageGenerator from './AssetImageGenerator';
import { uploadToPinata, uploadMetadataToPinata } from '../utils/ipfsUtils.js';
import NFT_ABI from '../abis/NFT.json';
import config from '../config.js';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { Buffer } from 'buffer';

// Make Buffer available globally for keccak256
window.Buffer = Buffer;

const UnifiedAssetWorkflow = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [metadata, setMetadata] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mintStatus, setMintStatus] = useState({ status: '', message: '' });
  
  // Add whitelist state
  const [account, setAccount] = useState(null);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [whitelistOnly, setWhitelistOnly] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [nftContract, setNftContract] = useState(null);

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

        // Check if whitelist is required
        const whitelistRequired = await nft.whitelistOnly();
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
            const whitelistStatus = await nft.isWhitelisted(userAccount, proof);
            setIsWhitelisted(whitelistStatus);
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
      }
      
      setIsLoading(false);
    };

    checkWhitelistStatus();
  }, []);

  const handleMetadataSubmit = async (formData) => {
    setIsSubmitting(true);
    setMetadata(formData);
    setIsSubmitting(false);
    setCurrentStep(2); // Move to preview step
  };

  const handleImageGenerated = (imageDataUrl) => {
    setGeneratedImage(imageDataUrl);
  };

  const requestWhitelist = async () => {
    if (!nftContract || !account) return;
    
    setMintStatus({ status: 'loading', message: 'Requesting whitelist access...' });
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // Check if user is owner
      const owner = await nftContract.owner();
      const isOwner = owner.toLowerCase() === account.toLowerCase();
      
      if (isOwner) {
        // Create a new merkle tree with just the user's address
        const leaf = keccak256(Buffer.from(account.slice(2), 'hex'));
        const leaves = [leaf];
        const merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
        const root = merkleTree.getHexRoot();
        
        // Set the new merkle root
        const transaction = await nftContract.connect(signer).setMerkleRoot(root, {
          gasLimit: 100000
        });
        await transaction.wait();
        
        // Store the whitelist in localStorage
        localStorage.setItem('whitelistedAddresses', JSON.stringify([account]));
        
        setMintStatus({ 
          status: 'success', 
          message: 'Successfully added to whitelist! You can now create and mint assets.' 
        });
        
        setIsWhitelisted(true);
      } else {
        // Try to disable whitelist requirement
        try {
          const transaction = await nftContract.connect(signer).setWhitelistOnly(false, {
            gasLimit: 100000
          });
          await transaction.wait();
          
          setMintStatus({ 
            status: 'success', 
            message: 'Whitelist requirement has been disabled. You can now create and mint assets.' 
          });
          
          setWhitelistOnly(false);
          setIsWhitelisted(true);
        } catch (error) {
          setMintStatus({ 
            status: 'error', 
            message: 'You don\'t have permission to modify the whitelist. Please use the contract owner account.' 
          });
        }
      }
    } catch (error) {
      console.error("Error in whitelist request:", error);
      setMintStatus({ 
        status: 'error', 
        message: `Whitelist request failed: ${error.message}` 
      });
    }
  };

  const handleMint = async () => {
    setCurrentStep(3); // Move to minting step
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

  const renderStepIndicator = () => {
    return (
      <div className="flex items-center justify-center mb-8">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === step 
                  ? 'bg-blue-500 text-white' 
                  : currentStep > step 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-200 text-gray-700'
              }`}
            >
              {currentStep > step ? '✓' : step}
            </div>
            {step < 3 && (
              <div 
                className={`h-1 w-16 ${
                  currentStep > step ? 'bg-green-500' : 'bg-gray-200'
                }`}
              ></div>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6 text-center">Create and Mint Asset</h2>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>