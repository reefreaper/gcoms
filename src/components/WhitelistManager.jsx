import { useState, useEffect, useCallback } from 'react'
import { MerkleTree } from 'merkletreejs'
import keccak256 from 'keccak256' // Used by WhitelistDatabase internally
import WhitelistDatabase from '../services/WhitelistDatabase';

const WhitelistManager = ({ provider, nft, account, setIsLoading }) => {
    const [address, setAddress] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [isOwner, setIsOwner] = useState(false)
    const [whitelistedAddresses, setWhitelistedAddresses] = useState([])
    const [merkleRoot, setMerkleRoot] = useState('')
    
    // Check if current user is owner
    const checkOwnership = useCallback(async () => {
        if (!nft || !account) return false
        
        try {
            const owner = await nft.owner()
            return owner.toLowerCase() === account.toLowerCase()
        } catch (error) {
            console.error("Error checking ownership:", error)
            return false
        }
    }, [nft, account])
    
    // Load whitelist from SQLite database
    const loadWhitelist = useCallback(async () => {
        try {
            const addresses = await WhitelistDatabase.getWhitelistedAddresses()
            setWhitelistedAddresses(addresses)
            console.log("Loaded whitelist from database:", addresses)
            return addresses
        } catch (error) {
            console.error("Error loading whitelist from database:", error)
            // Fallback to localStorage
            const storedAddresses = JSON.parse(localStorage.getItem('whitelistedAddresses') || '[]')
            setWhitelistedAddresses(storedAddresses)
            return storedAddresses
        }
    }, [])
    
    // Add a single address to whitelist
    const addToWhitelist = async (e) => {
        e.preventDefault()
        if (!nft || !account || !address) return
        
        setIsProcessing(true)
        setError('')
        setSuccess('')
        
        try {
            const signer = await provider.getSigner()
            
            // Verify owner status
            const ownerStatus = await checkOwnership()
            if (!ownerStatus) {
                setError("Only the contract owner can add users to whitelist")
                setIsProcessing(false)
                return
            }
            
            // Validate address format
            if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
                setError("Invalid Ethereum address format")
                setIsProcessing(false)
                return
            }
            
            // Add to SQLite database
            await WhitelistDatabase.addToWhitelist(address)
            
            // Reload whitelist
            const newAddresses = await loadWhitelist()
            
            // Generate new Merkle root
            const { root } = await WhitelistDatabase.generateMerkleRoot()
            setMerkleRoot(root)
            
            // Update Merkle root in contract
            const transaction = await nft.connect(signer).setMerkleRoot(root, {
                gasLimit: 100000
            })
            await transaction.wait()
            
            setSuccess(`Successfully added ${address} to whitelist!`)
            setAddress('') // Clear input
            setIsLoading(true) // Refresh UI
        } catch (error) {
            console.error("Error adding to whitelist:", error)
            setError(`Failed to add to whitelist: ${error.message}`)
        }
        
        setIsProcessing(false)
    }
    
    // Add multiple addresses to whitelist (comma-separated)
    const addMultipleToWhitelist = async () => {
        if (!nft || !account || !address) return
        
        setIsProcessing(true)
        setError('')
        setSuccess('')
        
        try {
            const signer = await provider.getSigner()
            
            // Verify owner status
            const ownerStatus = await checkOwnership()
            if (!ownerStatus) {
                setError("Only the contract owner can add users to whitelist")
                setIsProcessing(false)
                return
            }
            
            // Parse addresses (comma or space separated)
            const addressList = address.split(/[\s,]+/).filter(addr => addr.trim() !== '')
            
            // Validate addresses
            for (const addr of addressList) {
                if (!addr.match(/^0x[a-fA-F0-9]{40}$/)) {
                    setError(`Invalid Ethereum address format: ${addr}`)
                    setIsProcessing(false)
                    return
                }
            }
            
            // Add to SQLite database
            await WhitelistDatabase.addMultipleToWhitelist(addressList)
            
            // Reload whitelist
            const newAddresses = await loadWhitelist()
            
            // Generate new Merkle root
            const { root } = await WhitelistDatabase.generateMerkleRoot()
            setMerkleRoot(root)
            
            // Update Merkle root in contract
            const transaction = await nft.connect(signer).setMerkleRoot(root, {
                gasLimit: 100000
            })
            await transaction.wait()
            
            setSuccess(`Successfully added ${addressList.length} addresses to whitelist!`)
            setAddress('') // Clear input
            setIsLoading(true) // Refresh UI
        } catch (error) {
            console.error("Error adding to whitelist:", error)
            setError(`Failed to add to whitelist: ${error.message}`)
        }
        
        setIsProcessing(false)
    }
    
    // Export whitelist as JSON
    const exportWhitelist = async () => {
        try {
            const data = await WhitelistDatabase.exportDatabase();
            if (!data) {
                setError("Failed to export whitelist data");
                return;
            }
            
            const dataStr = JSON.stringify(data, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportFileDefaultName = 'whitelist-export.json';
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            
            setSuccess("Whitelist exported successfully");
        } catch (error) {
            console.error("Error exporting whitelist:", error);
            setError(`Failed to export whitelist: ${error.message}`);
        }
    }
    
    // Import whitelist from JSON file
    const importWhitelist = async (e) => {
        try {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            
            reader.onload = async (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    if (!data.addresses || !Array.isArray(data.addresses)) {
                        setError("Invalid whitelist file format");
                        return;
                    }
                    
                    setIsProcessing(true);
                    
                    // Import addresses
                    const result = await WhitelistDatabase.importAddresses(data.addresses);
                    
                    if (result) {
                        // Reload whitelist
                        await loadWhitelist();
                        
                        // Generate new Merkle root
                        const { root } = await WhitelistDatabase.generateMerkleRoot();
                        setMerkleRoot(root);
                        
                        // Update contract if connected
                        if (nft && provider) {
                            const signer = await provider.getSigner();
                            const transaction = await nft.connect(signer).setMerkleRoot(root, {
                                gasLimit: 100000
                            });
                            await transaction.wait();
                        }
                        
                        setSuccess(`Successfully imported ${data.addresses.length} addresses`);
                    } else {
                        setError("Failed to import addresses");
                    }
                    
                    setIsProcessing(false);
                } catch (error) {
                    console.error("Error parsing import file:", error);
                    setError(`Import error: ${error.message}`);
                    setIsProcessing(false);
                }
            };
            
            reader.readAsText(file);
        } catch (error) {
            console.error("Error importing whitelist:", error);
            setError(`Failed to import whitelist: ${error.message}`);
            setIsProcessing(false);
        }
    }
    
    // Toggle whitelist requirement
    const toggleWhitelistRequirement = async () => {
        if (!nft || !account) return
        
        setIsProcessing(true)
        setError('')
        setSuccess('')
        
        try {
            const signer = await provider.getSigner()
            
            // Verify owner status
            const ownerStatus = await checkOwnership()
            if (!ownerStatus) {
                setError("Only the contract owner can toggle whitelist requirement")
                setIsProcessing(false)
                return
            }
            
            // Get current whitelist requirement
            const currentRequirement = await nft.whitelistOnly()
            
            // Toggle it
            const transaction = await nft.connect(signer).setWhitelistOnly(!currentRequirement, {
                gasLimit: 100000
            })
            await transaction.wait()
            
            setSuccess(`Successfully ${!currentRequirement ? 'enabled' : 'disabled'} whitelist requirement!`)
            setIsLoading(true) // Refresh UI
        } catch (error) {
            console.error("Error toggling whitelist requirement:", error)
            setError(`Failed to toggle whitelist requirement: ${error.message}`)
        }
        
        setIsProcessing(false)
    }
    
    // Check ownership when component mounts
    useEffect(() => {
        const checkOwner = async () => {
            const result = await checkOwnership()
            setIsOwner(result)
        }
        
        if (nft && account) {
            checkOwner()
        }
    }, [nft, account, checkOwnership])
    
    // Load whitelist and merkle root when component mounts
    useEffect(() => {
        const loadData = async () => {
            await loadWhitelist()
            
            // Get current merkle root from contract
            if (nft) {
                try {
                    const root = await nft.merkleRoot()
                    setMerkleRoot(root)
                } catch (error) {
                    console.error("Error getting merkle root:", error)
                }
            }
        }
        
        loadData()
    }, [nft, loadWhitelist])
    
    // Close database connection when component unmounts
     useEffect(() => {
        return () => {
            // Close database connection when component unmounts
            WhitelistDatabase.close();
        };
    }, []); 
    
    if (!isOwner) {
        return (
            <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4">
                Whitelist management is only available to the contract owner.
            </div>
        )
    }
    
    return (
        <div className="mt-4 text-gray-800">
            <h4 className="text-xl font-semibold mb-3 text-gray-800">Whitelist Management (Merkle Tree)</h4>
            
            {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">{error}</div>}
            {success && <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4">{success}</div>}
            
            <div className="mb-4 p-3 border rounded bg-blue-50 border-blue-200 text-blue-800">
                <p>Current Merkle Root: {merkleRoot || 'Not set'}</p>
                <p>Addresses in whitelist: {whitelistedAddresses.length}</p>
            </div>
            
            <form onSubmit={addToWhitelist}>
                <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                        Ethereum Address
                    </label>
                    <input 
                        type="text" 
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        placeholder="0x..." 
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        disabled={isProcessing}
                    />
                    <p className="text-gray-600 text-xs italic mt-1">
                        Enter a single address or multiple addresses separated by commas
                    </p>
                </div>
                
                <div className="flex gap-2 flex-wrap">
                    <button 
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
                        type="submit"
                        disabled={isProcessing || !address}
                    >
                        {isProcessing ? 'Processing...' : 'Add Address'}
                    </button>
                    
                    <button 
                        className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
                        type="button"
                        onClick={addMultipleToWhitelist}
                        disabled={isProcessing || !address}
                    >
                        {isProcessing ? 'Processing...' : 'Add Multiple'}
                    </button>
                    
                    <button 
                        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
                        type="button"
                        onClick={exportWhitelist}
                        disabled={isProcessing || whitelistedAddresses.length === 0}
                    >
                        Export Whitelist
                    </button>
                    
                    <button 
                        className="ml-auto border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
                        type="button"
                        onClick={toggleWhitelistRequirement}
                        disabled={isProcessing}
                    >
                        {isProcessing ? 'Processing...' : 'Toggle Whitelist Requirement'}
                    </button>
                </div>
            </form>
        </div>
    )
}

export default WhitelistManager
