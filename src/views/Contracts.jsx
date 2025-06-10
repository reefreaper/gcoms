import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { Link } from 'react-router-dom'

// IMG
import preview from '../docs_img.jpeg';

// Components
import Navigation from '../components/Navigation';
import Loading from '../components/Loading';

// ABIs: Import your contract ABIs here
import NFT_ABI from '../abis/NFT.json'

// Config: Import your network config here
import config from '../config.json';

export default function Contracts() {   
  const [provider, setProvider] = useState(null)
  const [nft, setNFT] = useState(null)
  const [account, setAccount] = useState(null)
  
  // User's NFTs
  const [userNFTs, setUserNFTs] = useState([])
  
  // Selected NFT state
  const [selectedNFT, setSelectedNFT] = useState(null)

  const [isLoading, setIsLoading] = useState(true)
  
  // Print view state
  const [printViewImage, setPrintViewImage] = useState(null)

  // Refresh state
  const [refreshKey, setRefreshKey] = useState(0);

  // Refresh function
  const refreshData = () => {
    console.log("Manually refreshing data...");
    setIsLoading(true);
    setRefreshKey(prevKey => prevKey + 1);
  };

  const loadBlockchainData = async () => {
    try {
      // Initiate provider
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      setProvider(provider)

      // Initiate NFT contract
      const nft = new ethers.Contract(config[31337].nft.address, NFT_ABI, provider)
      setNFT(nft)

      // Fetch accounts
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const account = ethers.utils.getAddress(accounts[0])
      setAccount(account)

      // Fetch user's NFTs
      const balance = await nft.balanceOf(account)
      console.log(`Account ${account} has ${balance.toString()} NFTs`)
      
      if (parseInt(balance) > 0) {
        const tokenIds = await nft.walletOfOwner(account);
        console.log("Token IDs owned by account:", tokenIds.map(id => id.toString()));
        
        // Create an array to store NFT data with metadata
        const nftDataPromises = tokenIds.map(async (id) => {
          const tokenId = id.toString();
          let imageUrl = null;
          let metadata = null;
          
          try {
            // Get token URI
            const tokenURI = await nft.tokenURI(tokenId);
            console.log(`Token URI for ${tokenId}:`, tokenURI);
            
            // If tokenURI is an IPFS URI, fetch metadata
            if (tokenURI && tokenURI.includes('ipfs://')) {
              const ipfsHash = tokenURI.replace('ipfs://', '');
              const metadataUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
              console.log(`Fetching metadata from: ${metadataUrl}`);
              
              const response = await fetch(metadataUrl);
              if (response.ok) {
                metadata = await response.json();
                console.log(`Metadata for token ${tokenId}:`, metadata);
                
                // Get image URL from metadata
                if (metadata.image) {
                  if (metadata.image.startsWith('ipfs://')) {
                    const imageIpfsHash = metadata.image.replace('ipfs://', '');
                    imageUrl = `https://gateway.pinata.cloud/ipfs/${imageIpfsHash}`;
                  } else {
                    imageUrl = metadata.image;
                  }
                  console.log(`Image URL for token ${tokenId}:`, imageUrl);
                }
              } else {
                console.error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
              }
            }
          } catch (error) {
            console.error(`Error processing token ${tokenId}:`, error);
          }
          
          // Fallback to default image if metadata fetch failed
          //if (!imageUrl) {
          //  console.log(`Using fallback image for token ${tokenId}`);
          //  imageUrl = `https://gateway.pinata.cloud/ipfs/bafybeibf7yagmdkyttc7qb5ybvhytopogfi6c6mg6ktv6twutuyxv42ydm/${tokenId}.png`;
         // }
          
          return {
            id: tokenId,
            imageUrl: imageUrl,
            metadata: metadata
          };
        });
        
        const nftData = await Promise.all(nftDataPromises);
        setUserNFTs(nftData);
        console.log("User NFTs with metadata:", nftData);
      } else {
        console.log("Account has no NFTs");
        setUserNFTs([]);
      }
    } catch (error) {
      console.error("Error loading blockchain data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isLoading) {
      loadBlockchainData();
    }
  }, [isLoading, refreshKey]);

  useEffect(() => {
    // Set the default selected NFT to the last minted one when userNFTs changes
    if (userNFTs.length > 0 && !selectedNFT) {
      setSelectedNFT(userNFTs[userNFTs.length - 1]);
    }
  }, [userNFTs, selectedNFT]);

  // Handler for NFT selection
  const handleNFTSelect = (nft) => {
    setSelectedNFT(nft);
  };
  
  // Handler for print view
  const openPrintView = (nft) => {
    setPrintViewImage(nft);
  };
  
  // Handler to close print view
  const closePrintView = () => {
    setPrintViewImage(null);
  };
  
  // Handler to print the document
  const printDocument = () => {
    window.print();
  };

  return(
    <div className="w-full max-w-6xl mx-auto px-4 pb-12 text-gray-800 overflow-y-auto h-full">
      <Navigation account={account} />

      <div className="flex justify-between items-center mt-8 mb-6">
        <h2 className='text-2xl font-bold'>Your Asset Documents</h2>
        <div className="flex gap-3">
          <Link 
            to="/create-asset" 
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none"
          >
            Create New Asset
          </Link>
          <button 
            onClick={refreshData}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none"
          >
            Refresh Assets
          </button>
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="flex flex-col items-center">
              {userNFTs.length > 0 ? (
                <div className="w-full">
                  <h4 className="text-center mb-4 font-semibold">Selected Document</h4>
                  <div className="flex justify-center">
                    {selectedNFT && (
                      <div className="text-center">
                        <img 
                          src={selectedNFT.imageUrl}
                          alt={`Doc #${selectedNFT.id}`}
                          width="350"
                          height="500"
                          className="border rounded max-w-full h-auto cursor-pointer hover:shadow-lg transition-shadow"
                          onClick={() => openPrintView(selectedNFT)}
                        />
                        <p className="mt-2">Asset Doc #{selectedNFT.id}</p>
                        {selectedNFT.metadata && (
                          <div className="mt-2 text-left p-3 bg-gray-50 rounded text-sm">
                            <p className="font-semibold">{selectedNFT.metadata.name || `Asset #${selectedNFT.id}`}</p>
                            {selectedNFT.metadata.description && (
                              <p className="text-gray-600 mt-1">{selectedNFT.metadata.description}</p>
                            )}
                            {selectedNFT.metadata.attributes && selectedNFT.metadata.attributes.length > 0 && (
                              <div className="mt-2">
                                <p className="font-semibold text-xs text-gray-500">Attributes:</p>
                                <div className="grid grid-cols-2 gap-1 mt-1">
                                  {selectedNFT.metadata.attributes.map((attr, index) => (
                                    <div key={index} className="text-xs">
                                      <span className="text-gray-500">{attr.trait_type}:</span> {attr.value}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        <p className="text-sm text-gray-500 mt-1">(Click image to view printable version)</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <img 
                    src={preview}
                    alt="Document Preview"
                    width="350"
                    height="350"
                    className="max-w-full h-auto"
                  />
                  <p className="mt-2">You don't own any NFTs yet</p>
                  <Link 
                    to="/create-asset" 
                    className="mt-4 inline-block px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none"
                  >
                    Create Your First Asset
                  </Link>
                </div>
              )}
            </div>
            
            <div className="flex flex-col">
              <h4 className="text-center mb-4 font-semibold">Asset Document Details</h4>
              <p className="text-center mb-6">Each Asset Document is a unique, non-fungible token (NFT) that represents a specific asset. The NFT contains metadata that includes the asset's name, description, and other relevant information. The metadata is stored on the Ethereum blockchain, ensuring transparency and immutability.</p>
              
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                {userNFTs.map(nft => (
                  <div 
                    key={nft.id} 
                    className={`text-center cursor-pointer ${selectedNFT && selectedNFT.id === nft.id ? 'border-2 border-blue-500 p-1 rounded' : ''}`}
                    onClick={() => handleNFTSelect(nft)}
                  >
                    <img 
                      src={nft.imageUrl}
                      alt={`Doc #${nft.id}`}
                      width="80"
                      height="110"
                      className="border rounded"
                    />
                    <p className="mt-1 text-sm text-gray-500">Asset Doc #{nft.id}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Print View Modal */}
          {printViewImage && (
            <div className="fixed inset-0 bg-white bg-opacity-95 z-50 flex flex-col items-center justify-start p-4 overflow-auto">
              <div className="max-w-[8.5in] w-full bg-white rounded-lg overflow-hidden shadow-md print:shadow-none">
                <div className="p-4 bg-gray-100 flex justify-between items-center print:hidden">
                  <h3 className="text-lg font-medium">
                    {printViewImage.metadata?.name || `Asset Document #${printViewImage.id}`}
                  </h3>
                  <div>
                    <button 
                      onClick={printDocument}
                      className="mr-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none"
                    >
                      Print
                    </button>
                    <button 
                      onClick={closePrintView}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 focus:outline-none"
                    >
                      Close
                    </button>
                  </div>
                </div>
                <div className="p-4 flex justify-center bg-white">
                  <div className="w-full aspect-[8.5/11] relative">
                    <img 
                      src={printViewImage.imageUrl} 
                      alt={`Asset Document #${printViewImage.id}`}
                      className="w-full h-full object-contain border print:border-0"
                    />
                  </div>
                </div>
                <div className="p-4 text-center text-gray-500 text-sm print:hidden">
                  This document is sized for standard 8.5" x 11" paper.
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
