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
              
              <SectionHeading>Information We Collect</SectionHeading>
              <ul className="govuk-list govuk-list--bullet">
                <li><strong>Account Information:</strong> Email address, username, and password when you register</li>
                <li><strong>Profile Information:</strong> Optional display name and profile settings</li>
                <li><strong>Usage Data:</strong> Information about how you interact with our service</li>
                <li><strong>Technical Data:</strong> IP address, device information, browser type, and cookies</li>
                <li><strong>Content:</strong> Any content you create, upload, or stream through our service</li>
              </ul>

              <SectionHeading>How We Use Your Information</SectionHeading>
              <ul className="govuk-list govuk-list--bullet">
                <li>To provide, maintain, and improve our services</li>
                <li>To process and complete transactions</li>
                <li>To send service-related communications</li>
                <li>To respond to your inquiries and support requests</li>
                <li>To monitor and analyze usage patterns and trends</li>
              </ul>

              <SectionHeading>Data Sharing</SectionHeading>
              <p className="govuk-body">
                We do not sell your personal information. We may share data with:
              </p>
              <ul className="govuk-list govuk-list--bullet">
                <li>Service providers who assist in operating our platform</li>
                <li>As required by law or to protect our rights</li>
                <li>With your consent or at your direction</li>
              </ul>

              <SectionHeading>Your Rights</SectionHeading>
              <p className="govuk-body">You have the right to:</p>
              <ul className="govuk-list govuk-list--bullet">
                <li>Access your personal information</li>
                <li>Correct inaccurate information</li>
                <li>Delete your account and associated data</li>
                <li>Object to certain processing activities</li>
                <li>Download a copy of your data</li>
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