'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { Logo } from '@/components/logo'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function SignupPage() {
    const [displayName, setDisplayName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const signUp = useAuthStore((s) => s.signUp)
    const loading = useAuthStore((s) => s.loading)
    const user = useAuthStore((s) => s.user)
    const initialized = useAuthStore((s) => s.initialized)

    useEffect(() => {
        if (initialized && user) {
            router.push('/dashboard')
        }
    }, [initialized, user, router])

    const handleSignup = async () => {
        setError(null)

        if (!email.trim() || !password.trim()) {
            setError('Please fill in all required fields.')
            return
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters.')
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        const result = await signUp(email, password, displayName || undefined)
        if (result.error) {
            setError(result.error)
        } else {
            try {
                await fetch('/api/onboarding', { method: 'POST' })
            } catch {
                // Non-critical
            }
            router.push('/dashboard')
            router.refresh()
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSignup()
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="w-full max-w-lg mx-4 rounded-md px-10 py-10 space-y-7"
            style={{
                pointerEvents: 'auto',
                backgroundColor: 'rgba(10, 10, 10, 0.7)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
            }}
        >
            {/* Mobile logo */}
            <div className="flex items-center gap-2.5 lg:hidden mb-4">
                <Logo className="h-8 w-8 text-white" />
                <span className="text-2xl font-bold tracking-tight text-white">OFIERE</span>
            </div>

            <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-white">
                    Create Account
                </h2>
                <p className="text-sm text-neutral-400">
                    Register to create your own agent workspace.
                </p>
            </div>

            {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {error}
                </div>
            )}

            <div className="space-y-4">
                <div className="space-y-2">
                    <label htmlFor="displayName" className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        Display Name <span className="text-neutral-600">(optional)</span>
                    </label>
                    <input
                        id="displayName"
                        type="text"
                        placeholder="Operator"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex h-11 w-full rounded-lg border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/40 transition-all duration-200"
                        autoComplete="name"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="email" className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        placeholder="operator@ofiere.ai"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex h-11 w-full rounded-lg border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/40 transition-all duration-200"
                        autoComplete="email"
                        autoFocus
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="password" className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex h-11 w-full rounded-lg border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/40 transition-all duration-200"
                        autoComplete="new-password"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        Confirm Password
                    </label>
                    <input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex h-11 w-full rounded-lg border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/40 transition-all duration-200"
                        autoComplete="new-password"
                    />
                </div>

                <button
                    onClick={handleSignup}
                    disabled={loading}
                    className="flex h-11 w-full items-center justify-center rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-white mt-2"
                    style={{ backgroundColor: loading ? '#c2650a' : '#e87a13' }}
                    onMouseEnter={(e) => { if (!loading) (e.currentTarget.style.backgroundColor = '#c2650a') }}
                    onMouseLeave={(e) => { if (!loading) (e.currentTarget.style.backgroundColor = '#e87a13') }}
                >
                    {loading ? (
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Creating account...
                        </div>
                    ) : (
                        'Create Account'
                    )}
                </button>
            </div>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                </div>
            </div>

            <p className="text-center text-sm text-neutral-500">
                Already have an account?{' '}
                <Link href="/login" className="text-white hover:underline underline-offset-4 font-medium">
                    Sign in
                </Link>
            </p>
        </motion.div>
    )
}
