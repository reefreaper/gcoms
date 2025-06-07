// AppShell.jsx
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Building2, Calendar, Users, ClipboardList, ListChecks, BarChart2, Settings, Plus } from 'lucide-react'

import logo from '../docs_img.jpeg';

const navItems = [
	{ label: 'Dashboard', icon: <Home size={18} />, id: 'dashboard' },
	{ label: 'Create Asset', icon: <Plus size={18} />, id: 'create-asset' },
	{ label: 'Contracts', icon: <Home size={18} />, id: 'contracts' },
	{ label: 'Facilities', icon: <Building2 size={18} />, id: 'facilities' },
	{ label: 'Calendar', icon: <Calendar size={18} />, id: 'calendar' },
	{ label: 'Tasks', icon: <ListChecks size={18} />, id: 'tasks' },
	{ label: 'Referrals', icon: <Users size={18} />, id: 'referrals' },
	{ label: 'Activities', icon: <ClipboardList size={18} />, id: 'activities' },
	{ label: 'Reports', icon: <BarChart2 size={18} />, id: 'reports' },
	{ label: 'Settings', icon: <Settings size={18} />, id: 'settings' }
]

export default function LayoutShell({ children }) {
	const navigate = useNavigate()
	const location = useLocation()
	
	// Extract the current route from location
	const currentRoute = location.pathname.split('/')[1] || 'dashboard'
	const [active, setActive] = useState(currentRoute)

	const handleNavigation = (id) => {
		setActive(id)
		if (id === 'create-asset') {
			navigate('/create-asset')
		} else {
			navigate(`/${id}`)
		}
	}

	return (
		<div className="flex h-screen w-screen bg-gray-100 font-sans">
			{/* Sidebar */}
			<aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
				<div className="p-2 font-bold text-lg border-b border-gray-200 text-gray-500">
					<div className="flex items-center">
						<img
							alt="logo"
							src={logo}
							width="40"
							height="40"
							className="inline-block align-middle mr-2"
						/>
						<span className="text-gray-600">GeoCities</span>
					</div>
				</div>
				<nav className="flex-1 overflow-y-hidden">
					{navItems.map((item) => (
						<button
							key={item.id}
							onClick={() => handleNavigation(item.id)}
							className={`flex items-center px-4 py-3 text-sm w-full text-left hover:bg-gray-100 
								${active === item.id 
									? 'bg-gray-200 font-semibold text-gray-400' 
									: 'text-gray-500'
								}`}
						>
							<span className="mr-2">{item.icon}</span>
							{item.label}
						</button>
					))}
				</nav>
			</aside>

			{/* Main content */}
			<div className="flex-1 flex flex-col overflow-y-hidden">
				{/* Top Toolbar */}
				<header className="h-12 bg-white border-b border-gray-200 px-4 flex items-center justify-between">
					<div className="text-sm text-gray-500">Today is {new Date().toLocaleDateString()}</div>
					<div className="text-sm text-gray-500">Welcome, Citizen</div>
				</header>

				{/* App content */}
				<main className="flex-1 overflow-auto p-4">
					{children || <div className="text-gray-500">Select a section to begin</div>}
				</main>
			</div>
		</div>
	)
}
