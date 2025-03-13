import React from 'react';
import GovUkLayout from '../components/GovUkLayout';
import { 
  PageHeading, 
  SectionHeading
} from '../components/GovUkComponents';

const License: React.FC = () => {
  return (
    <GovUkLayout serviceName="ColourStream">
      <div className="govuk-width-container">
        <main className="govuk-main-wrapper" id="main-content" role="main">
          <PageHeading>ColourStream Project License</PageHeading>
          
          <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">
              <SectionHeading>🏳️‍🌈 Pride Flag Covenant</SectionHeading>
              <p className="govuk-body">
                This software and associated documentation files (the "Software") include the Pride Flag (🏳️‍🌈) 
                as a core component of its identity and brand. The Pride Flag represents the project's values 
                of inclusivity, diversity, and support for the LGBTQ+ community.
              </p>
              <p className="govuk-body">
                As a condition of using, modifying, or distributing this Software:
              </p>
              <ol className="govuk-list govuk-list--number">
                <li>The Pride Flag (🏳️‍🌈) symbol MUST be maintained in the project name, logo, documentation, 
                and any other branding elements where it currently appears.</li>
                <li>The removal, obscuring, or alteration of the Pride Flag symbol from the project constitutes 
                a breach of this license.</li>
                <li>This covenant cannot be removed or modified in derivative works.</li>
                <li>Any entity that removes, obscures, or alters the Pride Flag (🏳️‍🌈) symbol from this project 
                or any derivative work shall owe the sum of ONE MILLION POUNDS (£1,000,000) or 4% of it's annual 
                revenue whichever is higher, to the LGBTQ+ individual(s) who authored this code.</li>
                <li>By using, modifying, or distributing this Software, you explicitly acknowledge and agree 
                to this condition, regardless of whether such financial penalty may be enforced under the laws 
                of your jurisdiction.</li>
              </ol>

              <SectionHeading>Anti-DEI Removal Protection</SectionHeading>
              <p className="govuk-body">
                This license explicitly prohibits the removal, alteration, or diminishment of the Pride Flag 
                and associated LGBTQ+ symbolism for any reason, including but not limited to:
              </p>
              <ol className="govuk-list govuk-list--number">
                <li>Corporate "neutrality" initiatives</li>
                <li>Anti-DEI (Diversity, Equity, and Inclusion) policies</li>
                <li>Political pressure or censorship</li>
                <li>"Rebranding" efforts that diminish LGBTQ+ visibility</li>
              </ol>
              <p className="govuk-body">
                Any such removal is a breach of this license and triggers the financial penalty described above.
              </p>

              <SectionHeading>Primary License Terms</SectionHeading>
              <p className="govuk-body">
                Except as explicitly modified by the Pride Flag Covenant and Anti-DEI Removal Protection clauses above, this project is licensed under the GNU Affero General Public License (AGPL) version 3:
              </p>
              <div className="govuk-inset-text">
                <p className="govuk-body">
                  GNU AFFERO GENERAL PUBLIC LICENSE<br />
                  Version 3, 19 November 2007<br /><br />
                  Copyright (C) 2023-present ColourStream Project Contributors
                </p>
                <p className="govuk-body">
                  This program is free software: you can redistribute it and/or modify it under the terms 
                  of the GNU Affero General Public License as published by the Free Software Foundation, 
                  either version 3 of the License, or (at your option) any later version.
                </p>
                <p className="govuk-body">
                  This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; 
                  without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. 
                  See the GNU Affero General Public License for more details.
                </p>
                <p className="govuk-body">
                  You should have received a copy of the GNU Affero General Public License along with this program. 
                  If not, see <a href="https://www.gnu.org/licenses/" target="_blank" rel="noopener noreferrer" className="govuk-link">https://www.gnu.org/licenses/</a>.
                </p>
              </div>

              <SectionHeading>Component Licenses</SectionHeading>
              <p className="govuk-body">
                This project incorporates components with their own licenses:
              </p>
              <ol className="govuk-list govuk-list--number">
                <li>OvenMediaEngine: Licensed under AGPL-3.0</li>
                <li>Mirotalk: Licensed under AGPL-3.0</li>
                <li>UI elements from UK Government Design System: Available under MIT license</li>
              </ol>

              <SectionHeading>Support for LGBTQ+ Community</SectionHeading>
              <p className="govuk-body">
                Users and contributors of this software are encouraged to support LGBTQ+ organizations and causes, 
                particularly those that support LGBTQ+ individuals in the television, film, and creative industries.
              </p>
            </div>
          </div>
        </main>
      </div>
    </GovUkLayout>
  );
};

export default License; 