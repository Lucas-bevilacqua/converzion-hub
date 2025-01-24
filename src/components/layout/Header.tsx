import { Bot, Menu } from "lucide-react"
import { useAuth } from "@/contexts/auth/AuthContext"
import { Link } from "react-router-dom"

export const Header = () => {
  const { user } = useAuth()

  return (
    <header className="flex items-center justify-between p-4 bg-white shadow">
      <div className="flex items-center">
        <Bot className="h-8 w-8 text-primary" />
        <h1 className="ml-2 text-xl font-bold">My App</h1>
      </div>
      <nav className="flex items-center">
        <Link to="/" className="mr-4">Home</Link>
        {user ? (
          <Link to="/dashboard" className="mr-4">Dashboard</Link>
        ) : (
          <Link to="/login" className="mr-4">Login</Link>
        )}
        <Menu className="h-6 w-6" />
      </nav>
    </header>
  )
}

export default Header