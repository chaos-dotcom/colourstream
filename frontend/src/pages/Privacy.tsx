import React from 'react';
import GovUkLayout from '../components/GovUkLayout';
import { 
  PageHeading, 
  SectionHeading
} from '../components/GovUkComponents';

const Privacy: React.FC = () => {
  return (
    <GovUkLayout serviceName="ColourStream">
      <div className="govuk-width-container">
        <main className="govuk-main-wrapper" id="main-content" role="main">
          <PageHeading>Privacy Policy</PageHeading>
          
          <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">
              <p className="govuk-body-lead" style={{ fontWeight: 'bold' }}>
                Last Updated: {new Date().toLocaleDateString()}
              </p>
              
              <SectionHeading>Information your instance of ColourStream collects, this is not shared with any third parties or phoned back to us</SectionHeading>
              <ul className="govuk-list govuk-list--bullet">
                <li><strong>Account Information:</strong>the serverside of a webauthn credential when you login/register</li>
                <li><strong>Profile Information:</strong> Optional display name and profile settings</li>
              </ul>

              <SectionHeading>Contact Us</SectionHeading>
              <p className="govuk-body">
                If you have questions about this Privacy Policy, please contact the person responsible for selfhosting this service <a href={`mailto:${process.env.ADMIN_EMAIL}`} className="govuk-link">{process.env.ADMIN_EMAIL}</a>.
              </p>
            </div>
          </div>
        </main>
      </div>
    </GovUkLayout>
  );
};

export default Privacy; 