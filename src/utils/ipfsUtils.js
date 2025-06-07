import axios from 'axios';

// Get Pinata API keys from environment variables
const PINATA_API_KEY = import.meta.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = import.meta.env.PINATA_SECRET_API_KEY;

export async function uploadToPinata(file, name) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    // Add metadata for the file
    const metadata = JSON.stringify({
      name: name || 'asset-document',
    });
    formData.append('pinataMetadata', metadata);
    
    // Optional: Add pinata options
    const pinataOptions = JSON.stringify({
      cidVersion: 0,
    });
    formData.append('pinataOptions', pinataOptions);

    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        maxBodyLength: 'Infinity',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_API_KEY,
        },
      }
    );

    return { 
      ipfsHash: response.data.IpfsHash,
      pinataUrl: `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`
    };
  } catch (error) {
    console.error("Error uploading to Pinata:", error);
    throw error;
  }
}

export async function uploadMetadataToPinata(metadata, name) {
  try {
    const blob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
    return await uploadToPinata(blob, name || 'metadata.json');
  } catch (error) {
    console.error("Error uploading metadata to Pinata:", error);
    throw error;
  }
}
