"""Build the standalone institutional deployment proposal."""
from pathlib import Path
import gc
import fitz

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = HERE / 'REVA-IDEA-Lab-AWS-Deployment-Proposal.pdf'
pages = []

def table(headers, rows):
    return '<table><tr>' + ''.join(f'<th>{h}</th>' for h in headers) + '</tr>' + ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in row) + '</tr>' for row in rows) + '</table>'

def page(title, body):
    pages.append(f'<h1>{title}</h1>{body}')

page('AWS Deployment Proposal', '''
<p class="eyebrow">REVA UNIVERSITY · AICTE IDEA LAB</p>
<h2>University-owned digital portal for laboratory services, innovation and administration</h2>
<p class="lead">Proposal for production deployment on the University's AWS infrastructure</p>
<p>Submitted to: REVA University Administration, IDEA Lab and IT Department</p>
<table><tr><td><b>Reference</b></td><td>IDEALAB-PROP-2026-01</td></tr>
<tr><td><b>Submission date</b></td><td>09 October 2026</td></tr>
<tr><td><b>Document version</b></td><td>1.1 · For institutional review and approval</td></tr>
<tr><td><b>Project baseline</b></td><td>Portal v6.1.2</td></tr>
<tr><td><b>Budget currency</b></td><td>Indian Rupees (INR)</td></tr>
<tr><td><b>Prepared by</b></td><td>Six-member project team · details on page 13</td></tr></table>
<h2>Approval requested</h2>
<p>Permission to provision or allocate university-controlled AWS resources, configure institutional sign-in and email, activate approved payment collection, and complete acceptance testing before public launch.</p>
<p class="callout"><b>Proposed budget:</b> Core hosting ₹2,378 per month; core first year ₹31,036. With the recommended security package: ₹4,168 per month and ₹52,516 in year one. Payment gateway charges are additional and usage-based.</p>
<p class="small">This proposal includes the infrastructure specifications, itemised budget, service-charge assumptions, implementation plan and approval requirements for institutional consideration.</p>
''')
page('1. Executive summary and objectives', '''
<p>The REVA AICTE IDEA Lab Portal brings laboratory information, bookings, component requests, 3D-print services, PCB orders, events and staff administration into one university-managed web application. This proposal seeks approval to operate the portal on AWS under institutional ownership and oversight.</p>
<p>The existing implementation includes a React and TypeScript interface, a Node.js/Express API, MongoDB storage, private student design uploads, role-controlled dashboards and Razorpay payment integration. Docker Compose, nginx configuration, migration utilities and backup scripts are already present.</p>
<h2>Project objectives</h2>
<ul><li>Provide one accessible entry point for students, staff and approved external users.</li><li>Replace fragmented booking and request handling with traceable digital workflows.</li><li>Support server-calculated service charges, verified payments and downloadable receipts.</li><li>Give staff controlled access to inventory, orders, events, content and usage records.</li><li>Keep operational ownership, access credentials and production data under university control.</li></ul>
<h2>Proposed deliverables</h2>
<p>A functioning HTTPS portal on an approved university subdomain; configured authentication, transactional email and payment integrations; validated production data; scheduled off-server backups; an acceptance-test record; and an operational handover to designated university personnel.</p>
<h2>Scope boundaries</h2>
<p>This submission covers deployment and completion of the existing portal. Laboratory equipment purchases, consumables, staff remuneration, a mobile application and a high-availability redesign are outside the proposed budget.</p>
<h2>Document guide</h2>
''' + table(['Section', 'Page'], [('Features and access model','3–4'),('AWS architecture and resource requirements','5'),('Budget and financial planning','6–10'),('Remaining work and dependencies','11'),('Website maintenance and batch handover','12'),('Team details and approval','13'),('Technical references','14')]))
page('2. Portal features: users and services', '''
<p>The following features are represented in the current source. “Implemented” describes code availability; production readiness remains subject to institutional configuration and acceptance testing.</p>
''' + table(['Module', 'Implemented capability'], [
('Public information','Home, About, infrastructure, project listings and details, gallery, testimonials, events and event details.'),
('Student accounts','Microsoft sign-in for REVA accounts; Google sign-in for external visitors; email/password registration with mailbox verification, password recovery, onboarding and profile updates.'),
('User dashboard','Personal order and request history, status tracking and access to laboratory services.'),
('Events','Event discovery and registration; duplicate registration prevention and atomic seat reservation; staff-managed events and closures.'),
('Lab booking','Slot requests, approval/rejection, cancellation and closure checks. Overlapping time cells are protected against concurrent double booking; the current model reserves the lab as a whole.'),
('Components and indents','Inventory browsing and component requests with server-calculated pricing. Component borrowing is restricted to university accounts.'),
('3D printing','STL upload and browser preview; server-side geometry analysis and quotation; material, quality and infill choices; online checkout, order tracking and staff processing.'),
('PCB services','Board specification and design uploads; server-side quotation; online Razorpay or Pay at Lab workflow; staff queue and payment/status management.'),
('Receipts and records','PDF receipt generation, order history and staff approval information.'),
('Resource centre','Resource page layout exists; download, software and tutorial cards require real destinations before they can be presented as working resources.')]) + '''
<h2>Benefits to the university</h2><p>Students gain a consistent request channel and visible status. Lab personnel gain central queues and controlled approvals. Administration gains auditable usage records, an institutional hosting boundary and a clearer basis for service planning.</p>''')
page('3. Administration, access and safeguards', table(['Area','Current implementation'],[
('ADMIN','Overall administration, staff and administrator management, operational oversight and approval of submitted PDF reviews.'),
('LAB','Inventory and material pricing, 3D-print and PCB processing, event/booking review and operational history.'),
('EVENT_MANAGER','Event administration, booking review and laboratory closure scheduling.'),
('AMBASSADOR','Project, gallery and site content management; PDF submission/review workflow.'),
('TECH_SUPPORT','User management, activity visibility and sign-in audit access; administrator privileges remain restricted to ADMIN.'),
('Sign-in evidence','Separate Microsoft, Google and email/password audit databases; success/refusal records, filters, summary counts and CSV export. Application permissions permit reading and insertion, rather than editing or deletion.'),
('Authentication safeguards','Server-validated provider tokens, one-time sign-in handover, password hashing and lockout, verified email flows and session invalidation.'),
('Data and file safeguards','Server role and ownership checks; private design-file access through expiring links; upload size/type validation; request limits and security headers.'),
('Payment safeguards','Server-derived amounts; verified Razorpay signatures and webhooks; duplicate-payment handling and cancellation of stale unpaid orders.')]) + '''
<h2>Access policy to approve</h2>
<p>REVA Microsoft accounts receive university access. External Google accounts receive general access. In the current email-registration flow, a verified REVA mailbox also receives university access, while other verified mailboxes receive general access. Staff access requires prior staff provisioning; normal staff accounts use Microsoft sign-in, with an emergency administrator password retained for recovery.</p>
<h2>Institutional configuration</h2>
<p>University IT and accounts shall approve the enabled sign-in methods and payment routes before release. Payment-fee forecasts must include both 3D-print and PCB turnover collected online. The portal maintains a separate email/password sign-in audit database in addition to the provider-specific records.</p>
<p class="small">Audit records are append-only for the application account; a database administrator retains privileged control. This is not a claim of immutable or externally certified logging.</p>''')
page('4. AWS architecture and requirements', '''
<p>Deploy within the university-owned AWS account or university-allocated AWS server. The baseline is one EC2 instance in Mumbai (ap-south-1). IT should confirm available capacity and isolation if an existing server is shared with other university applications.</p>
<p class="callout"><b>Request path</b><br/>Browser → HTTPS / nginx → Express app container → private MongoDB container<br/><b>Persistent data:</b> EBS-backed database and upload volumes<br/><b>Supporting services:</b> SES email · S3 backup copies · EBS snapshots<br/><b>External integrations:</b> REVA Microsoft Entra ID · Google identity · Razorpay</p>
''' + table(['Resource','Baseline requirement'],[
('Compute and operating system','EC2 t3.small: 2 vCPU, 2 GB RAM; Ubuntu Server 24.04 LTS. Capacity must be validated with representative uploads and traffic.'),
('Persistent storage','30 GB gp3 EBS SSD for MongoDB, uploads and local backup retention; monitor free space.'),
('Network and domain','Static public IPv4 / Elastic IP; university DNS subdomain such as idealab.reva.edu.in; nginx with a renewing HTTPS certificate.'),
('Network restrictions','Public web access on 80/443; SSH only from approved university/VPN addresses. Do not expose MongoDB 27017 or application port 3001 publicly.'),
('Application runtime','Docker Engine and Compose; Node.js 22 application; MongoDB 7; persistent named volumes and restart policies.'),
('Identity and email','REVA Entra registration and redirect URL; Google OAuth credentials if enabled; SES verified sender/domain and production access [R1].'),
('Backups','Daily MongoDB and uploaded-file archives; 14-day local retention; off-server S3 copies and scheduled EBS snapshots.'),
('Optional security package','AWS WAF, CloudFront and Shield Standard, GuardDuty, Inspector, Secrets Manager and CloudWatch alarms.')]) + '''
<p class="small">The optional package still requires AWS configuration and validation. Secret retrieval/deployment must be wired up; storing a secret in Secrets Manager alone does not replace the application's environment configuration. CloudFront/WAF requires origin restrictions and correct forwarding/cache rules for authentication, API requests, private downloads and payment callbacks.</p>''')
page('5. Budget and financial summary', '''
<p>The proposed budget separates required cloud hosting, recommended security, one-time setup support and usage-based payment charges. Amounts are planning estimates for Mumbai (ap-south-1), subject to procurement verification. Detailed specifications and cost assumptions are included on the following pages.</p>
''' + table(['Budget item','Monthly (INR)','Year 1 (INR)'],[
('A. Required AWS hosting package','₹2,378','₹28,536'),
('B. Recommended extra AWS security','₹1,790','₹21,480'),
('C. Claude Pro, one month only','—','₹2,500'),
('Razorpay live activation / KYC','—','₹0'),
('Microsoft sign-in registration','—','₹0'),
('REVA subdomain and HTTPS certificate','—','₹0'),
('<b>Core: A × 12 + C</b>','<b>₹2,378</b>','<b>₹31,036</b>'),
('<b>Core + security: (A + B) × 12 + C</b>','<b>₹4,168</b>','<b>₹52,516</b>')]) + '''
<p>Core first-month provision including the one-time subscription: <b>₹4,878</b>. AWS package figures include 18% GST, at an assumed exchange rate of USD 1 = INR 85.</p>
<h2>Usage-based payment charges — outside fixed totals</h2>
<p>Budgeted domestic payment fees are 2% plus 18% GST on the fee; international/Amex fees are 3% plus GST. Confirm the institution's merchant agreement before activation. Any decision on passing fees to users requires university approval and applicable gateway terms.</p>
''' + table(['Medium-usage planning illustration','Monthly','Year 1'],[
('3D-print collections: 100 orders/month × ₹150','₹15,000','₹180,000'),
('Payment fees including GST','₹354','₹4,248'),
('Core costs including payment fees and one-time item','₹2,732','₹35,284'),
('With security, fees and one-time item','₹4,522','₹56,764')]) + '''
<p class="small">Collections are gross service revenue, not profit. The illustration excludes materials, laboratory operating costs and any additional online PCB collections. Staff time and lab hardware are not budgeted. University accounts must determine service-tax treatment, refund policy and receipt requirements. If existing AWS capacity is allocated, IT/finance should document the resource allocation and funding arrangement. Procurement should validate estimates before commitment.</p>''')
page('5.1 Itemised AWS expenditure', '''
<p>Quantities represent the initial deployment allowance. Rates are budget assumptions; monthly and annual amounts are in INR. GST is shown separately and included in each package total.</p>
''' + table(['Required hosting item','Specification / allowance','Monthly','Annual'],[
('EC2 compute','t3.small, 2 vCPU / 2 GB; 730 hours at USD 0.0224/hour','₹1,390','₹16,680'),
('EBS storage','30 GB gp3 SSD; USD 0.0912/GB-month','₹233','₹2,796'),
('Static public IPv4','730 hours; USD 0.005/hour','₹310','₹3,720'),
('S3 backup storage','Approximately 15 GB; USD 0.025/GB-month','₹32','₹384'),
('EBS snapshots','Approximately 10 GB changed data; USD 0.05/GB-month','₹42','₹504'),
('SES email','Approximately 1,000 emails/month; USD 0.10/1,000','₹8','₹96'),
('Internet data out','Allowance below 100 GB/month; assumed free-tier eligibility','₹0','₹0'),
('<b>Hosting subtotal</b>','Before tax','<b>₹2,015</b>','<b>₹24,180</b>'),
('GST','18%','₹363','₹4,356'),
('<b>A. Hosting total</b>','Including GST','<b>₹2,378</b>','<b>₹28,536</b>')]) + '''
<h2>Recommended security package</h2>
''' + table(['Security item','Specification / allowance','Monthly','Annual'],[
('AWS WAF','1 ACL, 5 rules, approximately 1M requests; USD 5 + USD 1/rule + USD 0.60/M requests','₹901','₹10,812'),
('CloudFront / Shield Standard','Assumed free-tier allowance: below 1 TB and 10M requests','₹0','₹0'),
('GuardDuty','Threat detection; assumed USD 3/month usage','₹255','₹3,060'),
('Inspector','Vulnerability scanning; assumed USD 1.25/server-month','₹106','₹1,272'),
('Secrets Manager','5 secrets; USD 0.40/secret-month','₹170','₹2,040'),
('CloudWatch','Approximately 1 GB logs and 10 alarms; assumed USD 1/month','₹85','₹1,020'),
('<b>Security subtotal</b>','Before tax','<b>₹1,517</b>','<b>₹18,204</b>'),
('GST','18%','₹273','₹3,276'),
('<b>B. Security total</b>','Including GST','<b>₹1,790</b>','<b>₹21,480</b>')]) + '''
<p class="small">Free-tier eligibility, metered usage and service coverage require confirmation in the university AWS account. The security package requires configuration of supported scanning, origin protection, secrets access and monitoring.</p>''')
page('5.2 Service charges and transactions', '''
<h2>Charging and collection model</h2>
''' + table(['Service','Price basis','Payment route'],[
('3D printing','Server-calculated model weight × material price/gram × quality multiplier: Standard 1, Medium 1.2, High 1.5; minimum ₹5. Staff maintain material rates.','Online Razorpay; unpaid orders expire after 30 minutes.'),
('PCB manufacturing','Server-calculated dimensions, layers, quantity and finish.','Online Razorpay or Pay at Lab; staff record lab payment.'),
('Components / indents','Inventory unit cost × quantity; free items remain ₹0.','Offline collection and staff payment recording.'),
('Events and slot booking','Free under the proposed service model.','No gateway fee.')]) + '''
<h2>Illustrative 3D-print charges</h2>
<p>Examples use demonstration material rates and 20% infill. Rounded model weights are shown for illustration; actual quotations use the server calculation.</p>
''' + table(['Example / material / quality','Weight','Charge','Fee 2%','GST on fee','Net receipt'],[
('5 cm³ part · PLA ₹5/g · Standard','3 g','₹14','₹0.28','₹0.05','₹13.67'),
('20 cm³ enclosure · PLA ₹5/g · Standard','11 g','₹55','₹1.10','₹0.20','₹53.70'),
('20 cm³ enclosure · PETG ₹6/g · High','11 g','₹101','₹2.02','₹0.36','₹98.62'),
('100 cm³ model · PLA ₹5/g · Standard','55 g','₹273','₹5.46','₹0.98','₹266.56'),
('100 cm³ model · PETG ₹6/g · High','56 g','₹503','₹10.06','₹1.81','₹491.13')]) + '''
<p><b>PCB quotation examples:</b> 50 × 50 mm, 2 layers, 5 boards: ₹2,050; 100 × 100 mm, 2 layers, 5 boards: ₹2,200; 100 × 100 mm, 4 layers, 10 boards with ENIG: ₹7,200. Online PCB collection incurs gateway fees; lab collection does not incur Razorpay fees.</p>
<h2>Payment administration</h2>
<p>Live activation requires institutional business documents, an approved bank account and merchant KYC. No setup or annual account fee is budgeted. At ₹20,000 of domestic online collections per month, estimated gateway charges including GST are ₹472.</p>
<p>Refunds are administered through the Razorpay dashboard under an approved university policy. Budget on the assumption that original processing fees may be retained; verify the merchant terms. The planning settlement period is approximately two working days, subject to the merchant account's actual schedule.</p>
<p class="small">Example material rates are not a proposed university tariff. The lab shall approve actual service charges before release. Any convenience fee requires a separate institutional decision and confirmation against gateway terms.</p>''')
page('5.3 Usage, taxation and assumptions', '''
<h2>Online 3D-print usage scenarios</h2>
''' + table(['Scenario','Orders / month','Average order','Monthly gross','Monthly fees + GST','Monthly net'],[
('Low','30','₹120','₹3,600','₹85','₹3,515'),
('Medium','100','₹150','₹15,000','₹354','₹14,646'),
('High','250','₹200','₹50,000','₹1,180','₹48,820')]) + table(['Scenario','Annual gross','Annual fees + GST','Annual net'],[
('Low','₹43,200','₹1,020','₹42,180'),
('Medium','₹180,000','₹4,248','₹175,752'),
('High','₹600,000','₹14,160','₹585,840')]) + '''
<p class="small">Rounded planning values assume domestic fees of 2% plus 18% GST on the fee. These scenarios cover only online 3D printing; include online PCB orders separately when forecasting actual gateway expenditure.</p>
<h2>Tax treatment and financial approvals</h2>
''' + table(['Item','Budget treatment / responsibility'],[
('AWS GST','18%; included in hosting and security package totals; payable by the institution on AWS invoices.'),
('Gateway GST','18% of the processing fee; included in transaction illustrations and deducted before settlement.'),
('Claude Pro','One seat for one month at ₹2,500; applicable tax assumed within this provision; renewals excluded.'),
('Tax on laboratory services','Not added separately by the current portal. University accounts shall approve classification, applicable tax, receipt format and any input-tax-credit treatment before launch.')]) + '''
<h2>Budget assumptions</h2>
<ul><li>On-demand AWS Mumbai deployment at USD 1 = INR 85; actual exchange rate, tax and usage can vary.</li><li>Microsoft registration uses the existing university Microsoft 365 subscription; DNS uses a REVA subdomain. MongoDB Community, nginx, Node.js, Docker and the HTTPS certificate have no separate licence provision.</li><li>GitHub source hosting and CI are assumed to remain within the applicable free allocation. Google sign-in has no separate subscription provision.</li><li>Staff time, printers, PCB equipment, consumables and other laboratory operating expenditure are excluded.</li><li>The 2 GB server is an initial configuration, not a guaranteed concurrency level. Capacity changes require review; the budget assumes no automatic scaling or failover.</li></ul>
<p class="small">Finance shall confirm final supplier charges and service-tax treatment. Any separately displayed tax or revised invoice requirements must be implemented and tested before affected services are enabled.</p>''')
page('5.4 Existing university AWS allocation', '''
<p>The university's existing AWS arrangement is the preferred hosting route. The portal can be deployed under institutional ownership without opening a separate AWS account. University IT shall allocate existing server capacity and services wherever available; the original full-resource budget remains a reference for resources that must be newly provisioned.</p>
<h2>Approximate additional project expenditure</h2>
<p>The estimates below use the same usage allowances, exchange rate and tax assumptions as the preceding budget. They describe additional expenditure attributable to this portal, rather than the university's total AWS bill.</p>
''' + table(['Allocation scenario','Additional monthly cost','First year'],[
('Existing server, disk capacity and public IP allocated; project pays only additional S3 backups, snapshots and email','Approximately ₹97','Approximately ₹3,664'),
('Existing server and public IP allocated; a new 30 GB disk allowance plus backups, snapshots and email is required','Approximately ₹372','Approximately ₹6,964'),
('Existing AWS account only; no available compute, disk or public IP allocation','₹2,378 core hosting','₹31,036'),
('All required cloud resources provided through an existing funded university allocation','₹0 additional lab cloud allocation, subject to IT confirmation','₹2,500 setup-support provision; cloud costs funded centrally')]) + '''
<p>First-year figures include the existing ₹2,500 one-time Claude Pro provision. Payment processing fees remain additional and depend on actual collections. The ₹97 estimate is (₹32 S3 + ₹42 snapshots + ₹8 email) × 1.18, rounded monthly. The ₹372 estimate additionally includes ₹233/month for disk before tax. Annual figures use the rounded monthly allowances × 12 plus ₹2,500.</p>
<h2>What can be reused</h2>
<p>University IT may provide an existing EC2 host, storage allowance, public IP, university subdomain, monitoring, backup infrastructure and approved security services. These items should not be charged again to the lab where existing capacity and funding cover the portal. If the recommended security services are not already provided, the separate ₹1,790/month allowance applies when that package is selected.</p>
<h2>Confirmation required from university IT</h2>
<p>Confirm the allocated server capacity, storage, backup provision, permitted production use, billing owner and any available institutional credits. An AWS account or institutional “licence” alone does not establish that new resource usage is prepaid. AWS credits offset eligible charges according to their terms; taxes and non-covered usage require separate confirmation [R3].</p>
<p class="callout"><b>Proposed allocation:</b> Request university-provided compute, disk and public IP, with an initial additional operating allowance of approximately ₹97/month for backups and email. Finalise this amount after IT confirms which services are already funded.</p>
<p class="small">[R3] AWS Billing, Applying AWS credits: <a href="https://docs.aws.amazon.com/us_en/awsaccountbilling/latest/aboutv2/useconsolidatedbilling-credits.html">Official AWS credit application guidance</a>. The university's contract and available capacity have not been inspected; these are conditional allocation estimates.</p>''')
page('6. Work remaining before production', '''
<p>The following work packages must be completed and documented before release. University IT shall confirm the current AWS environment and provide the required access and approvals.</p>
''' + table(['Work package','Owner / completion evidence'],[
('Infrastructure and DNS','University IT: allocate EC2 capacity, storage, static IP, restricted security group, instance role and subdomain; confirm isolation from other sites.'),
('Identity setup','University IT / team: register REVA Entra app; configure approved redirects and staff access. Configure production Google OAuth if external sign-in is retained; approve email-registration access policy.'),
('Email and payments','IT / accounts: verify SES identity and obtain production access; complete Razorpay KYC, bank mapping, live keys and webhook configuration. Approval lead times are external dependencies.'),
('Production configuration','Team: set production URL, new JWT/database/provider/payment secrets and sender region; remove mock identity settings; provision emergency administrator and approved staff roles.'),
('Credential retirement','Team / IT: rotate previously exposed legacy Supabase, Firebase and Google credentials referenced by deployment documentation; verify repository tracking and retire unused services after migration approval.'),
('Data and content','Lab / team: migrate legacy users, orders and files if needed; reconcile counts, ownership and file access. Verify production inventory, materials, charges, events, branding and staff photos.'),
('Resource-centre completion','Team / lab: connect actual manuals, software URLs and video tutorials, or clearly remove unavailable entries. Current resource cards have no working destinations.'),
('Financial and policy decisions','University accounts / lab: approve charges, tax presentation, receipts, refund/cancellation handling, privacy notice, retention and support contact. Tax-line changes may require code work.'),
('Backups and monitoring','IT / team: schedule backup script, S3 copy and snapshots; test restoration of database, audit records and files; establish disk/health monitoring and incident contacts.'),
('Final validation and release','Team / university reviewers: run current CI checks and production UAT; resolve failures, record sign-off and execute a controlled cutover.')]) + '''
<p class="small">Resource links and any approved tax/receipt changes remain application work. Optional cloud-security services require separate deployment and validation before they can be accepted as operational.</p>''')
page('7. Website maintenance and handover', '''
<p>After deployment, the project team will maintain the portal in coordination with IDEA Lab staff and university IT. Routine laboratory updates can be performed through the existing staff dashboard, while technical updates follow the documented deployment process. Long-term ownership will remain with the university as student batches change.</p>
<h2>Maintenance after deployment</h2>
''' + table(['Frequency / activity','Responsibility and method'],[
('Routine laboratory operations','Authorised lab staff manage bookings, events, orders, inventory, material prices and site content through their role-based dashboards.'),
('Weekly service review','The student maintenance team checks website availability, sign-in, uploads, service requests and application logs; records issues and coordinates corrections with the lab.'),
('Daily backups','University IT schedules the existing database and uploaded-file backup script, with off-server copies. The maintenance team checks completion and periodically verifies restoration with IT.'),
('Monthly technical upkeep','University IT and the maintenance team review server storage, billing, operating-system and dependency updates, certificate renewal and integration-secret expiry dates.'),
('Website improvements','The team records requested changes, reviews the code, runs the existing automated checks and build, and deploys an approved release using the documented Docker Compose process.')]) + '''
<h2>Handover when the current team graduates</h2>
<p>A faculty coordinator and university IT will retain ownership of the AWS account, domain, source repository, payment account and institutional integrations. The incoming student team will receive named access appropriate to its responsibilities, so continued operation does not depend on a graduating member's personal account.</p>
''' + table(['Handover step','Deliverable'],[
('1. Nominate the next batch','The lab appoints a student maintenance team and faculty contact before the outgoing team graduates.'),
('2. Transfer the operating guide','Provide the repository, setup/deployment guides, dashboard instructions, backup procedure, service inventory, renewal calendar and open-work list. Transfer credentials through university-approved secure channels.'),
('3. Conduct practical training','Demonstrate content updates, order and booking administration, local setup, test execution, deployment and backup verification. The incoming team repeats the tasks under supervision.'),
('4. Confirm ownership and access','Faculty/IT verify the incoming team can perform agreed tasks; record acceptance and remove outgoing access once the transition is complete.')]) + '''
<h2>Why the transition is straightforward</h2>
<p>The portal already includes role-based administration, a standard React/Node.js stack, Docker Compose deployment, automated tests and written deployment/testing guides. Routine content changes require no code edits. Technical changes use the same repository and repeatable build process, allowing each incoming batch to continue from the existing system.</p>''')
page('8. Project team and institutional approval', '''
<p>The six-member project team and assigned responsibilities are listed below. Project responsibilities are separate from application access roles.</p>
''' + table(['No.','Member name','Project role'],[
('1','Abhinav Pramod Kumar','Co-Lead / Backend Development'),
('2','Chaitanya Suresha','Co-Lead / Backend Development'),
('3','Sanjan S Acharya','Frontend Development'),
('4','Sandeep','UI/UX Design'),
('5','Irfan','Inventory Management'),
('6','Anthony Joshua L','Quality Assurance Tester')]) + '''
<h2>Institutional review and decision</h2>
<p>Requested funding route: □ Core ₹31,036 year one &nbsp; □ With security ₹52,516 year one<br/>□ Existing university AWS allocation: estimated ₹3,664–₹6,964 year one, subject to the allocation in Section 5.4.<br/>Usage-based payment charges: additional, as detailed in Section 5.<br/>Hosting allocation: □ New EC2 resource &nbsp; □ Existing university AWS capacity</p>
''' + table(['Signatory','Name / designation','Signature / date'],[
('Prepared by / team representative','____________________','____________________'),
('Reviewed by / faculty mentor','____________________','____________________'),
('Technical review / university IT','____________________','____________________'),
('Financial review / accounts','____________________','____________________'),
('Approved by / competent authority','____________________','____________________')]) + '''
<p>Comments / conditions: __________________________________________________<br/><br/>___________________________________________________________________</p>''')
page('9. Technical references', '''
<h2>Internal project evidence</h2>
<p><b>Architecture and operations:</b> README.md, README_BACKEND.md, DEPLOYMENT.md, docker-compose.yml, Dockerfile, deploy/nginx.conf, deploy/mongo-init.js and deploy/backup.sh.</p>
<p><b>Feature evidence:</b> src/App.tsx; user and staff pages/components; server/routes for authentication, passwords, Google/Microsoft identity, content, lab services, printing, storage, payments and sign-in records; server/lib/roles.ts.</p>
<p><b>Verification resources:</b> package.json, .github/workflows/ci.yml, server/test, TESTING.md and SECURITY.md. Production acceptance shall use test evidence from the final release.</p>
<h2>Official deployment references</h2>
<p>[R1] Amazon SES, Verified identities:<br/><a href="https://docs.aws.amazon.com/ses/latest/dg/verify-addresses-and-domains.html">docs.aws.amazon.com/ses/latest/dg/verify-addresses-and-domains.html</a><br/>Supports the sender-verification and sandbox-recipient restrictions described in this proposal.</p>
<p>[R2] AWS, Shared Responsibility Model:<br/><a href="https://aws.amazon.com/compliance/shared-responsibility-model/">aws.amazon.com/compliance/shared-responsibility-model/</a><br/>Supports the assignment of guest operating-system, application and security-group management to the customer.</p>
<h2>Approval and release records</h2>
<p>The deployment handover shall retain the final infrastructure inventory, approved service charges, identity and payment configuration records, release-test results, migration reconciliation, backup/restore evidence and institutional acceptance.</p>
<p class="callout"><b>Release authority:</b> Public launch shall proceed after the designated university authority accepts the implementation, financial arrangements and operational ownership described in this proposal.</p>
''')

CSS = '''
@font-face {font-family: Arial; src: url(arial.ttf);}
@font-face {font-family: Arial; src: url(arialbd.ttf); font-weight: bold;}
body {font-family: Arial; font-size: 9.8pt; line-height: 1.25; color: #26364a;}
h1 {font-size: 24pt; color: #15314e; margin: 0 0 17pt;}
h2 {font-size: 13pt; color: #15314e; margin: 15pt 0 7pt;}
p {margin: 0 0 10pt;}
table {border-collapse: collapse; width: 100%; margin: 10pt 0 12pt;}
th {background-color: #15314e; color: white; font-weight: bold; text-align: left;}
td, th {border: 0.5pt solid #ccd5df; padding: 5pt; vertical-align: top; font-size: 9pt;}
li {margin-bottom: 6pt;}
.small {font-size: 8.6pt; color: #546477;}
.callout {background-color: #edf3f8; padding: 12pt;}
.eyebrow {color: #af5b22; font-size: 12pt; font-weight: bold; margin-top: 20pt;}
.lead {font-size: 15pt; margin: 24pt 0;}
a {color: #245c8c;}
'''

def build():
    temp = HERE / '_proposal_body.pdf'
    writer = fitz.DocumentWriter(str(temp))
    archive = fitz.Archive('C:/Windows/Fonts')
    for number, content in enumerate(pages, 1):
        story = fitz.Story(content, user_css=CSS, archive=archive)
        device = writer.begin_page(fitz.Rect(0, 0, 595.28, 841.89))
        more, _ = story.place(fitz.Rect(43, 68, 552, 780))
        assert not more, f'Content overflows proposal page {number}'
        story.draw(device)
        writer.end_page()
    writer.close()
    doc = fitz.open(temp)
    for number, p in enumerate(doc, 1):
        p.draw_rect(fitz.Rect(0, 0, 595.28, 9), color=None, fill=(0.08, 0.19, 0.31))
        p.insert_text((43, 35), 'REVA UNIVERSITY  |  AICTE IDEA LAB', fontsize=8, color=(0.22, 0.32, 0.42))
        p.draw_line((43, 796), (552, 796), color=(0.75, 0.80, 0.85), width=0.5)
        p.insert_text((43, 812), 'IDEALAB-PROP-2026-01  |  Institutional deployment proposal', fontsize=7.5)
        p.insert_text((482, 812), f'{number} / {len(pages)}', fontsize=8)
    doc.set_metadata({'title':'REVA AICTE IDEA Lab — AWS Deployment Proposal','author':'REVA AICTE IDEA Lab Project Team','subject':'Institutional AWS deployment, features, implementation and financial proposal','keywords':'REVA, IDEA Lab, AWS, proposal, deployment, budget'})
    doc.set_toc([[1, 'Proposal cover', 1], [1, 'Executive summary', 2], [1, 'Portal features', 3], [1, 'Administration and access', 4], [1, 'AWS architecture', 5], [1, 'Budget summary', 6], [2, 'Itemised AWS expenditure', 7], [2, 'Service charges and transactions', 8], [2, 'Usage, taxation and assumptions', 9], [2, 'Existing university AWS allocation', 10], [1, 'Remaining work', 11], [1, 'Website maintenance and handover', 12], [1, 'Team and approval', 13], [1, 'Technical references', 14]])
    doc.save(OUT, garbage=4, deflate=True)
    doc.close()
    del writer
    gc.collect()
    temp.unlink()
    check = fitz.open(OUT)
    assert len(check) == 14
    text = ''.join(p.get_text() for p in check).replace('\u00a0', ' ').replace('\u00ad', '-')
    assert all(value in text for value in ['₹2,378','₹31,036','₹52,516','completion'])
    assert not any(term in text.lower() for term in ['bom', 'appendix', 'unchanged', 'supplied'])
    assert 'risks' not in text.lower()
    assert 'Website maintenance and handover' in text
    assert all(name in text for name in ['Abhinav Pramod Kumar', 'Chaitanya Suresha', 'Sanjan S Acharya', 'Sandeep', 'Irfan', 'Anthony Joshua L', 'Quality Assurance Tester'])
    assert all(value in text for value in ['₹97', '₹372', '₹3,664', '₹6,964'])
    for i in [9, 12]:
        check[i].get_pixmap(matrix=fitz.Matrix(1.2, 1.2)).save(HERE / f'_proposal_preview_{i+1}.png')
    print(f'Created standalone proposal: {OUT} ({len(check)} pages); budget and content checks passed.')

if __name__ == '__main__':
    build()
