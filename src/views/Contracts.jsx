import { useEffect, useState } from 'react'
import Countdown from 'react-countdown'
import { ethers } from 'ethers'
import { MerkleTree } from 'merkletreejs'
import keccak256 from 'keccak256'
import { Buffer } from 'buffer'

// Make Buffer available globally for keccak256
window.Buffer = Buffer

// IMG
import preview from '../docs_img.jpeg';

// Components
import Button from '../components/ui/Button';
import Col from '../components/ui/Col';
import Row from '../components/ui/Row';
import Form from '../components/ui/Form';
import Input from '../components/ui/Row';
import Navigation from '../components/Navigation';
import Data from '../components/Data';
import Mint from '../components/Mint';
import Loading from '../components/Loading';
import WhitelistManager from '../components/WhitelistManager';

// ABIs: Import your contract ABIs here
import NFT_ABI from '../abis/NFT.json'

// Config: Import your network config here
import config from '../config.json';

export default function Contracts() {   
  const [provider, setProvider] = useState(null)
  const [nft, setNFT] = useState(null)

  const [account, setAccount] = useState(null)
  //const [balance, setBalance] = useState(0)

  // set reveal time
  const [revealTime, setRevealTime] = useState(0)
  const [maxSupply, setMaxSupply] = useState(0)
  const [totalSupply, setTotalSupply] = useState(0)
  const [cost, setCost] = useState(0)
  const [balance, setBalance] = useState(0) // balance of NFTs 
  
  // Whitelist state
  const [isWhitelisted, setIsWhitelisted] = useState(false)
  const [whitelistOnly, setWhitelistOnly] = useState(true)
  
  // User's NFTs
  const [userNFTs, setUserNFTs] = useState([])
  
  // Add new state for selected NFT
  const [selectedNFT, setSelectedNFT] = useState(null)

  const [isLoading, setIsLoading] = useState(true)
  
  // Add state for print view
  const [printViewImage, setPrintViewImage] = useState(null)

  const loadBlockchainData = async () => {
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

    // Fetch Countdown  
    const allowMintingOn = await nft.allowMintingOn()
    setRevealTime(allowMintingOn.toString() + '000')

    // Fetch max supply
    setMaxSupply(await nft.maxSupply())
    
    // Fetch total supply
    setTotalSupply(await nft.totalSupply())

    // Fetch cost
    setCost(await nft.cost())

    // Fetch balance
    setBalance(await nft.balanceOf(account))
    
    // Fetch whitelist status
    try {
      const whitelistOnlyStatus = await nft.whitelistOnly()
      setWhitelistOnly(whitelistOnlyStatus)
      console.log("Whitelist only status:", whitelistOnlyStatus)
      
      if (whitelistOnlyStatus) {
        try {
          // Check if we have stored whitelist addresses
          const storedAddresses = JSON.parse(localStorage.getItem('whitelistedAddresses') || '[]')
          console.log("Stored whitelist addresses:", storedAddresses)
          console.log("Current account:", account)
          console.log("Is account in stored addresses:", storedAddresses.includes(account))
          
          if (storedAddresses.includes(account)) {
            // If the account is in our stored whitelist, generate a proper proof
            // IMPORTANT: Use the EXACT same hashing method as the contract
            const leaves = storedAddresses.map(addr => 
              keccak256(Buffer.from(addr.slice(2), 'hex'))
            )
            const merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true })
            const leaf = keccak256(Buffer.from(account.slice(2), 'hex'))
            const proof = merkleTree.getHexProof(leaf)
            console.log("Generated Merkle proof:", proof)
            
            const whitelistStatus = await nft.isWhitelisted(account, proof)
            setIsWhitelisted(whitelistStatus)
            console.log(`Account ${account} whitelist status with stored proof: ${whitelistStatus}`)
          } else {
            // Try with empty proof as fallback
            console.log("Account not in stored whitelist, trying with empty proof")
            const whitelistStatus = await nft.isWhitelisted(account, [])
            setIsWhitelisted(whitelistStatus)
            console.log(`Account ${account} whitelist status with empty proof: ${whitelistStatus}`)
            
            // If the user is the contract owner, they should be able to mint regardless
            try {
              const owner = await nft.owner()
              if (owner.toLowerCase() === account.toLowerCase()) {
                console.log("User is contract owner, setting isWhitelisted to true")
                setIsWhitelisted(true)
              }
            } catch (error) {
              console.error("Error checking owner:", error)
            }
          }
        } catch (error) {
          console.log("Could not verify whitelist status:", error)
          setIsWhitelisted(false)
        }
      } else {
        // If whitelist is not required, consider everyone "whitelisted"
        console.log("Whitelist not required, setting isWhitelisted to true")
        setIsWhitelisted(true)
      }
    } catch (error) {
      console.error("Error checking whitelist:", error)
      setIsWhitelisted(false)
    }
    
    // Fetch user's NFTs
    try {
      if (parseInt(await nft.balanceOf(account)) > 0) {
        const tokenIds = await nft.walletOfOwner(account)
        const nftData = tokenIds.map(id => ({
          id: id.toString(),
          //imageUrl: `https://gateway.pinata.cloud/ipfs/QmQPEMsfd1tJnqYPbnTQCjoa8vczfsV1FmqZWgRdNQ7z3g/${id.toString()}.png`
          imageUrl: `https://gateway.pinata.cloud/ipfs/bafybeibf7yagmdkyttc7qb5ybvhytopogfi6c6mg6ktv6twutuyxv42ydm/${id.toString()}.png`
        }))
        setUserNFTs(nftData)
        console.log("User NFTs:", nftData)
      }
    } catch (error) {
      console.error("Error fetching user NFTs:", error)
    }

    setIsLoading(false)
  }

  useEffect(() => {
    if (isLoading) {
      loadBlockchainData()
    }
  }, [isLoading]);

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

      <h2 className='mt-8 mb-6 text-center text-2xl font-bold'>Mint Your Asset</h2>

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
                </div>
              )}
            </div>
            
            <div className="flex flex-col">
              <div className='my-4 text-center font-bold'>
                <p>Minting Starts In:</p>
                <Countdown date={parseInt(revealTime)} className='text-xl' />
              </div>

              <Data
                maxSupply={maxSupply}
                totalSupply={totalSupply}
                cost={cost}
                balance={balance}
                isWhitelisted={isWhitelisted}
                whitelistOnly={whitelistOnly}
              />

              <Mint
                provider={provider}
                nft={nft}
                cost={cost}
                setIsLoading={setIsLoading}
                isWhitelisted={isWhitelisted}
                whitelistOnly={whitelistOnly}
                account={account}
              />
            </div>
          </div>
          
          <div className="mb-8">
            <h4 className="text-center mb-4 font-semibold">Asset Document Details</h4>
            <p className="text-center mb-6">Each Asset Document is a unique, non-fungible token (NFT) that represents a specific asset. The NFT contains metadata that includes the asset's name, description, and other relevant information. The metadata is stored on the Ethereum blockchain, ensuring transparency and immutability.</p>

            <div className="flex flex-wrap justify-center gap-3">
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

          <div className="mb-8">
            <WhitelistManager 
              provider={provider}
              nft={nft}
              account={account}
              setIsLoading={setIsLoading}
            />
          </div>
          
          {/* Print View Modal */}
          {printViewImage && (
            <div className="fixed inset-0 bg-white bg-opacity-95 z-50 flex flex-col items-center justify-start p-4 overflow-auto">
              <div className="max-w-[8.5in] w-full bg-white rounded-lg overflow-hidden shadow-md print:shadow-none">
                <div className="p-4 bg-gray-100 flex justify-between items-center print:hidden">
                  <h3 className="text-lg font-medium">Asset Document #{printViewImage.id}</h3>
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
