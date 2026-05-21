// app/login/page.tsx
"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, User as UserIcon, Lock as LockIcon, Eye, EyeOff } from "lucide-react" // Import Eye and EyeOff icons
import Link from "next/link" // Import Link component

export default function LoginForm() {
  const { login, isSubmitting } = useAuth()
  const [username, setUsername] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [showPassword, setShowPassword] = useState<boolean>(false) // State for password visibility

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    if (!username || !password) {
      setError("Please enter both username and password.")
      return
    }

    const result = await login(username, password)

    if (!result.success) {
      setError(result.error || "Login failed. Please check your credentials.")
    }
    // On success, the AuthProvider handles the redirect automatically
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-olive-50 via-white to-olive-100"> {/* Light olive gradient background */}
      <Card className="w-full max-w-lg mx-auto border-none shadow-xl rounded-xl overflow-hidden">
        <div className="p-6 text-center bg-gradient-to-r from-olive-100 to-olive-200 text-olive-800 font-bold text-2xl rounded-t-xl">
          <div className="flex flex-col items-center gap-3">
            <img src="/Passary-refractories-logo.png" alt="Logo" className="h-16 w-auto" onError={(e) => (e.currentTarget.style.display = 'none')} />
            Production Planning-App
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <CardHeader className="pt-8 pb-4"> {/* Increased top padding */}
            {/* Removed CardTitle and CardDescription as requested */}
          </CardHeader>
          <CardContent className="space-y-6 px-8 pt-4 pb-0"> {/* Increased horizontal and vertical spacing */}
            {error && (
              <Alert variant="destructive" className="bg-red-50 text-red-700 border-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-3"> {/* Increased spacing */}
              <Label htmlFor="username" className="text-gray-700 flex items-center gap-2 text-base">
                <UserIcon className="h-6 w-6 text-olive-700" /> Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                required
                value={username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                disabled={isSubmitting}
                className="border-olive-300 focus:ring-olive-500 focus:border-olive-500 text-gray-800 p-3 text-lg"
              />
            </div>
            <div className="space-y-3"> {/* Increased spacing */}
              <Label htmlFor="password" className="text-gray-700 flex items-center gap-2 text-base">
                <LockIcon className="h-6 w-6 text-olive-700" /> Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  required
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="border-olive-300 focus:ring-olive-500 focus:border-olive-500 text-gray-800 pr-10 p-3 text-lg"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-600 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="pt-8 px-8 pb-8">
            <Button type="submit" className="w-full bg-gradient-to-r from-olive-700 to-olive-800 text-white hover:from-olive-800 hover:to-olive-900 p-3.5 text-lg" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>
          </CardFooter>
        </form>
      </Card>
      {/* Footer for the entire page */}
      <div className="absolute bottom-0 w-full p-4 text-center text-sm text-white bg-gradient-to-r from-olive-700 to-olive-800">
        Powered by{" "}
        <Link href="https://www.botivate.in/" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">
          Botivate
        </Link>
      </div>
    </div>
  )
}
