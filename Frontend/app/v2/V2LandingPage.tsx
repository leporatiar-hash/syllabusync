'use client'

import dynamic from 'next/dynamic'
import Nav from './components/Nav'
import Hero from './components/Hero'
import CredibilityStrip from './components/CredibilityStrip'

// Below-the-fold sections are code-split out of the initial bundle.
const ProblemStory = dynamic(() => import('./components/ProblemStory'))
const HowItWorks = dynamic(() => import('./components/HowItWorks'))
const Pricing = dynamic(() => import('./components/Pricing'))
const Testimonials = dynamic(() => import('./components/Testimonials'))
const FAQ = dynamic(() => import('./components/FAQ'))
const FinalCTA = dynamic(() => import('./components/FinalCTA'))
const Footer = dynamic(() => import('./components/Footer'))

export default function V2LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Nav />
      <Hero />
      <CredibilityStrip />
      <ProblemStory />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  )
}
