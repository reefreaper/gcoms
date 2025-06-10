// Import dependencies that work in browser
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

// Create a browser-compatible version of the database
class WhitelistDatabase {
  constructor() {
    this.initBrowserStorage();
  }

  initBrowserStorage() {
    // No SQLite initialization needed - we'll use localStorage
    console.log('Using browser localStorage for whitelist storage');
  }

  getWhitelistedAddresses() {
    return new Promise((resolve) => {
      try {
        const addresses = JSON.parse(localStorage.getItem('whitelistedAddresses') || '[]');
        console.log("Retrieved addresses from localStorage:", addresses);
        resolve(addresses);
      } catch (error) {
        console.error('Error getting addresses from localStorage:', error);
        resolve([]);
      }
    });
  }

  addToWhitelist(address) {
    return new Promise((resolve) => {
      try {
        const addresses = JSON.parse(localStorage.getItem('whitelistedAddresses') || '[]');
        if (!addresses.includes(address)) {
          addresses.push(address);
          localStorage.setItem('whitelistedAddresses', JSON.stringify(addresses));
          console.log(`Added ${address} to whitelist in localStorage`);
          resolve(true);
        } else {
          console.log(`Address ${address} already in whitelist`);
          resolve(false);
        }
      } catch (error) {
        console.error('Error adding to whitelist in localStorage:', error);
        resolve(false);
      }
    });
  }

  addMultipleToWhitelist(addressList) {
    return new Promise((resolve) => {
      try {
        const addresses = JSON.parse(localStorage.getItem('whitelistedAddresses') || '[]');
        let added = 0;
        
        for (const address of addressList) {
          if (!addresses.includes(address)) {
            addresses.push(address);
            added++;
          }
        }
        
        localStorage.setItem('whitelistedAddresses', JSON.stringify(addresses));
        console.log(`Added ${added} addresses to whitelist in localStorage`);
        resolve(true);
      } catch (error) {
        console.error('Error adding multiple addresses to whitelist in localStorage:', error);
        resolve(false);
      }
    });
  }

  isWhitelisted(address) {
    return new Promise((resolve) => {
      try {
        const addresses = JSON.parse(localStorage.getItem('whitelistedAddresses') || '[]');
        resolve(addresses.includes(address));
      } catch (error) {
        console.error('Error checking whitelist in localStorage:', error);
        resolve(false);
      }
    });
  }

  async generateMerkleRoot() {
    try {
      const addresses = await this.getWhitelistedAddresses();
      
      if (addresses.length === 0) return null;
      
      // Create leaf nodes
      const leaves = addresses.map(addr => 
        keccak256(Buffer.from(addr.slice(2), 'hex'))
      );
      
      // Create Merkle Tree
      const merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      
      // Get root
      return {
        root: merkleTree.getHexRoot(),
        merkleTree,
        addresses
      };
    } catch (error) {
      console.error('Error generating Merkle root:', error);
      return null;
    }
  }

  async getMerkleProof(address) {
    try {
      const result = await this.generateMerkleRoot();
      
      if (!result || !result.merkleTree || !result.addresses.includes(address)) {
        return null;
      }
      
      const leaf = keccak256(Buffer.from(address.slice(2), 'hex'));
      return result.merkleTree.getHexProof(leaf);
    } catch (error) {
      console.error('Error generating Merkle proof:', error);
      return null;
    }
  }

  async exportDatabase() {
    try {
      const addresses = await this.getWhitelistedAddresses();
      return {
        addresses,
        exportDate: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error exporting database:', error);
      return null;
    }
  }

  async importAddresses(addressList) {
    try {
      if (!Array.isArray(addressList) || addressList.length === 0) {
        return false;
      }
      
      // Validate addresses
      const validAddresses = addressList.filter(addr => 
        typeof addr === 'string' && addr.match(/^0x[a-fA-F0-9]{40}$/)
      );
      
      if (validAddresses.length === 0) {
        return false;
      }
      
      // Add to localStorage
      await this.addMultipleToWhitelist(validAddresses);
      return true;
    } catch (error) {
      console.error('Error importing addresses:', error);
      return false;
    }
  }

  close() {
    // Nothing to close in browser environment
    console.log('Database connection closed (browser mode)');
  }

  getPendingRequests() {
    return new Promise((resolve) => {
      try {
        const requests = JSON.parse(localStorage.getItem('whitelistRequests') || '[]');
        console.log("Retrieved pending requests from localStorage:", requests);
        resolve(requests);
      } catch (error) {
        console.error('Error getting pending requests from localStorage:', error);
        resolve([]);
      }
    });
  }

  addWhitelistRequest(address, reason = '') {
    return new Promise((resolve) => {
      try {
        // Get current requests
        const requests = JSON.parse(localStorage.getItem('whitelistRequests') || '[]');
        
        // Check if address already has a pending request
        if (requests.some(req => req.address.toLowerCase() === address.toLowerCase())) {
          console.log("Address already has a pending request:", address);
          resolve(false);
          return;
        }
        
        // Add new request
        const newRequest = {
          id: Date.now().toString(),
          address: address,
          timestamp: new Date().toISOString(),
          reason: reason
        };
        
        requests.push(newRequest);
        localStorage.setItem('whitelistRequests', JSON.stringify(requests));
        console.log("Added whitelist request for:", address);
        resolve(true);
      } catch (error) {
        console.error('Error adding whitelist request to localStorage:', error);
        resolve(false);
      }
    });
  }

  removeWhitelistRequest(requestId) {
    return new Promise((resolve) => {
      try {
        // Get current requests
        const requests = JSON.parse(localStorage.getItem('whitelistRequests') || '[]');
        
        // Filter out the request to remove
        const updatedRequests = requests.filter(req => req.id !== requestId);
        
        if (updatedRequests.length === requests.length) {
          // Request not found
          resolve(false);
          return;
        }
        
        localStorage.setItem('whitelistRequests', JSON.stringify(updatedRequests));
        console.log("Removed whitelist request:", requestId);
        resolve(true);
      } catch (error) {
        console.error('Error removing whitelist request from localStorage:', error);
        resolve(false);
      }
    });
  }
}

export default new WhitelistDatabase();
