import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import GovUkLayout from '../components/GovUkLayout';
import { 
  PageHeading, 
  SectionHeading, 
  Panel
} from '../components/GovUkComponents';

const About: React.FC = () => {
  return (
    <GovUkLayout serviceName="ColourStream">
      <div className="govuk-width-container">
        <main className="govuk-main-wrapper" id="main-content" role="main">
          <PageHeading>Welcome to ColourStream</PageHeading>
          
          <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">
              <p className="govuk-body">
                ColourStream is an open-source video streaming platform built by colourists for colourists. 
                Designed with deep expertise in colour workflows, it provides professional tools for 
                secure collaboration between colour professionals and their clients.
              </p>
              <p className="govuk-body">
                Our platform combines three core pillars: enterprise-grade security through zero-trust architecture 
                and siloed design principles; sub-5 frame latency streaming for real-time colour decisions; and 
                accessible, open source award winning UX through our implementation of the UK Government Design System. 
                This unique combination makes ColourStream the professional's choice for colour-critical streaming and file sharing.
              </p>
              <p className="govuk-body">
                ColourStream was built on the fundamental belief that colourist tools should be open source.
                For too long, our industry has been dominated by closed, proprietary software that limits what we can do
                and how we can collaborate. ColourStream is completely open source, embodying transparency and community-driven development.
                This means you can inspect the code, contribute improvements, or customize it to your specific needs
                with limited restriction. Our open source approach ensures the platform evolves with the real-world needs of
                colourists.
              </p>
              <p className="govuk-body">
                We are proud signatories of the <a href="https://live.colourstream.johnrogerscolour.co.uk/license" target="_blank" rel="noopener noreferrer" className="govuk-link">Pride Flag Covenant</a>, affirming our commitment to creating inclusive
                technology that respects and supports all members of our community. We believe that diversity
                strengthens our tools and ensures they serve everyone in the colour grading industry, regardless
                of background or identity. You can read our full <a href="/license" className="govuk-link">license</a> for more details.
              </p>
              <p className="govuk-body">
                ColourStream was written by <a href="https://johnrogerscolour.co.uk" target="_blank" rel="noopener noreferrer" className="govuk-link">John Rogers</a>, 
                a professional colourist with extensive experience in the industry.
              </p>
            </div>
          </div>
          
          <div className="govuk-grid-row" style={{ marginTop: '30px', marginBottom: '30px' }}>
            <div className="govuk-grid-column-full">
              <SectionHeading>Key Features & Benefits</SectionHeading>
              <p className="govuk-body">
                ColourStream is a self-hosted platform designed specifically for professional colourists, offering:
              </p>
              <div className="govuk-grid-row">
                <div className="govuk-grid-column-one-half">
                  <ul className="govuk-list govuk-list--bullet">
                    <li>🎥 <strong>Professional Streaming:</strong> Secure, high-quality video with less than 5 frames latency</li>
                    <li>🔒 <strong>Data Privacy:</strong> Client media stays on your systems, not third-party servers</li>
                    <li>👑 <strong>Complete Control:</strong> Own and manage your entire workflow and data</li>
                    <li>💻 <strong>Modern Interface:</strong> Intuitive admin dashboard and responsive design</li>
                  </ul>
                </div>
                <div className="govuk-grid-column-one-half">
                  <ul className="govuk-list govuk-list--bullet">
                    <li>🔄 <strong>Customizable:</strong> Open source codebase you can modify for your needs</li>
                    <li>💰 <strong>Cost Effective:</strong> Pay only hosting costs, no per-user or feature fees</li>
                    <li>🌈 <strong>Inclusive Technology:</strong> Proud <a href="/license" className="govuk-link">Pride Flag Covenant</a> signatory</li>
                    <li>🙂‍↕️ <strong>Colour Spelt Properly:</strong> British spelling throughout (colour with a 'u', as it should be)</li>
                  </ul>
                </div>
              </div>
              
              <p className="govuk-body" style={{ marginTop: '20px' }}>
                Being self-hosted means you avoid platform degradation <a href="https://en.wikipedia.org/wiki/Enshittification" className="govuk-link">"enshittification"</a>, maintain independence from third-party policies,
                and keep complete control over your professional tools and client data.
              </p>
            </div>
          </div>
          
          <div className="govuk-grid-row" style={{ marginTop: '30px' }}>
            <div className="govuk-grid-column-one-half">
              <SectionHeading>Getting Started</SectionHeading>
              <p className="govuk-body">
                To access the platform's features, please log in to your account or contact the administrator
                for access credentials.
              </p>
            </div>
          </div>
        </main>
      </div>
    </GovUkLayout>
  );
};

export default About; 