import { useState } from 'react';
import { ethers } from 'ethers';
import AssetMetadataForm from '../components/AssetMetadataForm';
import AssetImageGenerator from '../components/AssetImageGenerator';
import { uploadToPinata, uploadMetadataToPinata } from '../utils/ipfsUtils.js';
import NFT_ABI from '../abis/NFT.json';
import config from '../config.js'; // Updated import

function CreateAsset() {
  const [metadata, setMetadata] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mintStatus, setMintStatus] = useState({ status: '', message: '' });

  const handleMetadataSubmit = async (formData) => {
    setIsSubmitting(true);
    setMetadata(formData);
    setIsSubmitting(false);
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
          const { MerkleTree } = require('merkletreejs');
          const keccak256 = require('keccak256');
          
          // Create leaf nodes
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

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-6">Create New Asset</h2>
      
      <AssetMetadataForm 
        onMetadataSubmit={handleMetadataSubmit}
        isSubmitting={isSubmitting}
      />
      
      {metadata && (
        <AssetImageGenerator 
          metadata={metadata}
          onImageGenerated={handleImageGenerated}
        />
      )}
      
      {generatedImage && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-4">Generated Asset Document</h3>
          <img 
            src={generatedImage} 
            alt="Generated Asset Document" 
            className="border rounded shadow-sm max-w-full h-auto"
          />
          <div className="mt-4 flex space-x-4">
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
    </div>
  );
}

export default CreateAsset;
