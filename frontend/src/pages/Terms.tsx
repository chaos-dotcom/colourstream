import React from 'react';
import GovUkLayout from '../components/GovUkLayout';
import { 
  PageHeading, 
  SectionHeading
} from '../components/GovUkComponents';

const Terms: React.FC = () => {
  return (
    <GovUkLayout serviceName="ColourStream">
      <div className="govuk-width-container">
        <main className="govuk-main-wrapper" id="main-content" role="main">
          <PageHeading>Terms of Service</PageHeading>
          
          <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">
              <p className="govuk-body-lead" style={{ fontWeight: 'bold' }}>
                Last Updated: {new Date().toLocaleDateString()}
              </p>
              
              <p className="govuk-body">
                Please read these Terms of Service carefully before using the ColourStream platform. By accessing or using our service, you agree to be bound by these terms.
              </p>
              
              <SectionHeading>1. Acceptance of Terms</SectionHeading>
              <p className="govuk-body">
                By accessing or using ColourStream, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
              </p>

              <SectionHeading>2. Description of Service</SectionHeading>
              <p className="govuk-body">
                ColourStream provides a platform for video streaming, collaboration, and file sharing for color grading and creative professionals. Our services include but are not limited to:
              </p>
              <ul className="govuk-list govuk-list--bullet">
                <li>Live video streaming for remote color grading sessions</li>
                <li>Secure file upload and sharing capabilities</li>
                <li>Client collaboration tools</li>
                <li>Project management features</li>
              </ul>

              <SectionHeading>3. User Accounts</SectionHeading>
              <p className="govuk-body">
                To access certain features of our service, you must create an account. You are responsible for:
              </p>
              <ul className="govuk-list govuk-list--bullet">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Ensuring your account information is accurate and up-to-date</li>
              </ul>
              <p className="govuk-body">
                We reserve the right to terminate or suspend accounts that violate these terms or for any other reason at our discretion.
              </p>

              <SectionHeading>4. Content and Conduct</SectionHeading>
              <p className="govuk-body">
                You retain ownership of any content you upload, share, or transmit through our service. However, you grant us a license to use, store, and share this content as necessary to provide our services.
              </p>
              <p className="govuk-body">
                You agree not to use our service to:
              </p>
              <ul className="govuk-list govuk-list--bullet">
                <li>Upload or transmit illegal, harmful, or offensive content</li>
                <li>Infringe on intellectual property rights</li>
                <li>Harass, abuse, or harm others</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Interfere with or disrupt our services</li>
              </ul>

              <SectionHeading>5. Privacy and Data Protection</SectionHeading>
              <p className="govuk-body">
                Our <a href="/privacy" className="govuk-link">Privacy Policy</a> describes how we collect, use, and protect your personal information. By using our service, you agree to our privacy practices.
              </p>

              <SectionHeading>6. Service Limitations and Modifications</SectionHeading>
              <p className="govuk-body">
                We strive to provide reliable and high-quality services, but:
              </p>
              <ul className="govuk-list govuk-list--bullet">
                <li>We do not guarantee that our services will be error-free or uninterrupted</li>
                <li>We may modify, suspend, or discontinue any part of our service at any time</li>
                <li>We may update these Terms of Service periodically</li>
              </ul>

              <SectionHeading>7. Limitation of Liability</SectionHeading>
              <p className="govuk-body">
                To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, resulting from your use of or inability to use our service.
              </p>

              <SectionHeading>8. Termination</SectionHeading>
              <p className="govuk-body">
                You may terminate your account at any time. We may also terminate or suspend access to our service immediately, without prior notice or liability, for any reason, including breach of these Terms.
              </p>

              <SectionHeading>9. Governing Law</SectionHeading>
              <p className="govuk-body">
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which the service provider operates, without regard to its conflict of law provisions.
              </p>

              <SectionHeading>Contact Us</SectionHeading>
              <p className="govuk-body">
                If you have any questions about these Terms of Service, please contact <a href={`mailto:${process.env.ADMIN_EMAIL}`} className="govuk-link">{process.env.ADMIN_EMAIL}</a>.
              </p>
            </div>
          </div>
        </main>
      </div>
    </GovUkLayout>
  );
};

export default Terms; 