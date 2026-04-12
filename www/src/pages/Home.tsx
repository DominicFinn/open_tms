import Hero from '../components/Hero'
import Features from '../components/Features'
import ForCarriers from '../components/ForCarriers'
import ForShippers from '../components/ForShippers'
import OpenSource from '../components/OpenSource'
import Platform from '../components/Platform'
import Roadmap from '../components/Roadmap'
import CTA from '../components/CTA'

export default function Home() {
  return (
    <>
      <Hero />
      <Features />
      <ForShippers />
      <ForCarriers />
      <Platform />
      <OpenSource />
      <Roadmap />
      <CTA />
    </>
  )
}
