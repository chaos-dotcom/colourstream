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
              <SectionHeading>About ColourStream</SectionHeading>
              <p className="govuk-body">
                ColourStream is a powerful, secure video streaming platform designed and developed by a colourist,
                for colourists. Built with a deep understanding of colour workflows, ColourStream offers a seamless 
                experience for both professionals and clients.
              </p>
              <p className="govuk-body">
                Our platform prioritizes security,by utilising zero-trust architecture, and a siloed design, 
                performance with extremly low latency live streams and in browser resumable uploads, 
                and ease of use and accessibility utilising the UK Government Design System, making it the ideal choice
                for professional streaming needs in the colour grading industry.
              </p>
              <p className="govuk-body">
                ColourStream was written by <a href="https://johnrogerscolour.co.uk" target="_blank" rel="noopener noreferrer" className="govuk-link">John Rogers</a>, 
                a professional colourist with extensive experience in the industry.
              </p>
            </div>
          </div>
          
          <div className="govuk-grid-row" style={{ marginTop: '30px' }}>
            <div className="govuk-grid-column-full">
              <SectionHeading>Self-Hosted Advantage</SectionHeading>
              <p className="govuk-body">
                ColourStream is designed to be fully self-hosted, providing several key advantages:
              </p>
              <ul className="govuk-list govuk-list--bullet">
                <li>🚫 <strong>No Enshittification:</strong> Avoid the common problem of platforms degrading quality or introducing unwanted changes to maximize profit</li>
                <li>👑 <strong>Complete Control:</strong> You own and control your entire workflow and data</li>
                <li>🔏 <strong>Data Privacy:</strong> Client media stays on your systems, not on third-party servers</li>
                <li>🔄 <strong>Customizability:</strong> Modify and adapt the platform to your specific workflow needs</li>
                <li>💰 <strong>No Subscription Fees:</strong> Pay only for your hosting costs, not per-user or feature fees</li>
                <li>🔒 <strong>Independence:</strong> Your tools won't disappear due to company shutdowns, acquisitions, or policy changes</li>
              </ul>
              <p className="govuk-body">
                By self-hosting ColourStream, colourists maintain control over their professional tools and workflows, 
                ensuring they remain stable, private, and tailored to actual needs rather than corporate profit motives.
              </p>
            </div>
          </div>
          
          <div className="govuk-grid-row" style={{ marginTop: '30px', marginBottom: '30px' }}>
            <div className="govuk-grid-column-one-half">
              <SectionHeading>Features</SectionHeading>
              <ul className="govuk-list govuk-list--bullet">
                <li>Secure, high-quality video streaming</li>
                <li>Administrative dashboard for stream management</li>
                <li>Realtime Live Streaming for Remote Review Sessions, with less than 5 frames of latency Powered By Oven Media Engine and Mirotalk</li>
                <li>Secure file upload functionality</li>
                <li>Modern, responsive user interface</li>
                <li>British spelling throughout (colour with a 'u', as it should be)</li>
              </ul>
            </div>
            
            <div className="govuk-grid-column-one-half">
              <SectionHeading>Getting Started</SectionHeading>
              <p className="govuk-body">

              </p>
            </div>
          </div>
        </main>
      </div>
    </GovUkLayout>
  );
};

export default About; 