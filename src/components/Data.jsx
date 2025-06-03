import { ethers } from 'ethers'

const Data = ({ maxSupply, totalSupply, cost, balance, isWhitelisted, whitelistOnly }) => {
  return(
    <div className="bg-white p-4 rounded-lg shadow-sm mb-4 text-gray-800">
      <div className="grid grid-cols-1 gap-2">
        <div className="flex justify-between">
          <span className="font-medium">Available to Mint:</span>
          <span className="text-blue-600 font-semibold">{maxSupply - totalSupply}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="font-medium">Cost to Mint:</span>
          <span className="text-blue-600 font-semibold">{ethers.utils.formatEther(cost)} ETH</span>
        </div>
        
        <div className="flex justify-between">
          <span className="font-medium">You own:</span>
          <span className="text-blue-600 font-semibold">{balance.toString()}</span>
        </div>
        
        {whitelistOnly && (
          <div className="flex justify-between">
            <span className="font-medium">Whitelist Status:</span>
            <span className={isWhitelisted ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
              {isWhitelisted ? '✅ Whitelisted' : '❌ Not Whitelisted'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default Data;
