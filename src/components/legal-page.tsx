interface LegalPageProps {
  type: 'privacy' | 'terms'
  onBack: () => void
}

const containerClass =
  'mx-auto max-w-[720px] px-4 py-8 text-foreground'

const titleClass = 'text-2xl font-bold tracking-tight text-foreground mb-1'
const lastUpdatedClass = 'text-sm text-muted-foreground mb-8'
const h2Class = 'text-lg font-semibold mt-8 mb-2 text-foreground'
const pClass = 'text-sm text-muted-foreground leading-relaxed mb-3'
const listClass = 'text-sm text-muted-foreground leading-relaxed mb-3 list-disc pl-5 space-y-1'

export function LegalPage({ type, onBack }: LegalPageProps) {
  const isPrivacy = type === 'privacy'

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className={containerClass}>
          <div className="flex items-center gap-4 py-4">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                onBack()
              }}
              className="text-sm font-medium text-primary hover:underline underline-offset-4"
            >
              ← Back to TCC Modeler
            </a>
          </div>
        </div>
      </header>
      <main className={`flex-1 ${containerClass} pb-12`}>
        {isPrivacy ? <PrivacyContent /> : <TermsContent />}
      </main>
    </div>
  )
}

function PrivacyContent() {
  return (
    <>
      <h1 className={titleClass}>Privacy Policy</h1>
      <p className={lastUpdatedClass}>Last updated: February 2025</p>

      <p className={pClass}>
        TCC Modeler (“we”, “our”, or “the service”) is a total cash compensation modeling tool. This policy describes how we handle information in connection with your use of the application.
      </p>

      <h2 className={h2Class}>1. Information we collect</h2>
      <p className={pClass}>
        The application runs primarily in your browser. Provider and market data you upload are processed locally in your session. We do not transmit your uploaded files or modeled scenarios to our servers unless you explicitly use a feature that does so (e.g. saving to cloud, if offered in the future).
      </p>
      <p className={pClass}>
        We may collect limited technical and usage information (e.g. browser type, general usage patterns) to operate and improve the service. We do not sell your data to third parties.
      </p>

      <h2 className={h2Class}>2. How we use information</h2>
      <p className={pClass}>
        We use information only to provide, maintain, and improve the TCC Modeler service and to comply with applicable law.
      </p>

      <h2 className={h2Class}>3. Data storage and retention</h2>
      <p className={pClass}>
        Data you enter or upload may be stored in your browser (e.g. local storage) for your convenience. Clearing your browser data may remove saved scenarios. We do not guarantee retention of any data stored locally.
      </p>

      <h2 className={h2Class}>4. Cookies and similar technologies</h2>
      <p className={pClass}>
        We may use essential cookies or local storage to keep the application functioning (e.g. preferences, session state). We do not use third-party advertising cookies.
      </p>

      <h2 className={h2Class}>5. Your rights</h2>
      <p className={pClass}>
        Depending on your jurisdiction, you may have rights to access, correct, or delete personal data we hold. To exercise these or ask questions about this policy, contact us using the details provided in the application or on the hosting page.
      </p>

      <h2 className={h2Class}>6. Changes</h2>
      <p className={pClass}>
        We may update this Privacy Policy from time to time. The “Last updated” date at the top will be revised when we do. Continued use of the service after changes constitutes acceptance of the updated policy.
      </p>
    </>
  )
}

function TermsContent() {
  return (
    <>
      <h1 className={titleClass}>Terms of Use</h1>
      <p className={lastUpdatedClass}>Last updated: February 2025</p>

      <p className={pClass}>
        These Terms of Use (“Terms”) apply to your access to and use of TCC Modeler (“the Service”). By using the Service, you agree to these Terms. If you do not agree, do not use the Service.
      </p>

      <h2 className={h2Class}>1. License and use</h2>
      <p className={pClass}>
        We grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for its intended purpose: internal provider compensation modeling and related analysis. You may not use the Service for any unlawful purpose or in any way that could damage, disable, or impair the Service or our systems.
      </p>

      <h2 className={h2Class}>2. Acceptable use</h2>
      <p className={pClass}>You agree not to:</p>
      <ul className={listClass}>
        <li>Copy, clone, reverse engineer, or attempt to derive the source code, structure, or logic of the Service or any part of it.</li>
        <li>Build a product or service that competes with or substantially replicates TCC Modeler, including its features, workflow, or design.</li>
        <li>Scrape, harvest, or automate access to the Service beyond normal use through the provided interface.</li>
        <li>Resell, sublicense, or commercially redistribute the Service or access to it without our prior written consent.</li>
        <li>Remove or alter any copyright, trademark, or other proprietary notices.</li>
      </ul>

      <h2 className={h2Class}>3. Intellectual property</h2>
      <p className={pClass}>
        The Service, including its software, design, layout, branding, and documentation, is owned by us or our licensors and is protected by copyright and other intellectual property laws. You do not acquire any ownership rights by using the Service. You retain ownership of the data you upload and the outputs you generate for your own internal use.
      </p>

      <h2 className={h2Class}>4. Disclaimers</h2>
      <p className={pClass}>
        The Service is provided “as is” and “as available.” We do not warrant that it will be uninterrupted, error-free, or fit for any particular purpose. Modeling results are for internal planning and discussion only and do not constitute legal, tax, or professional advice. You are responsible for verifying any outputs before relying on them.
      </p>

      <h2 className={h2Class}>5. Limitation of liability</h2>
      <p className={pClass}>
        To the fullest extent permitted by law, we and our affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of data, revenue, or profits, arising from your use or inability to use the Service, even if we have been advised of the possibility of such damages. Our total liability shall not exceed the amount you paid to use the Service in the twelve (12) months preceding the claim, or one hundred dollars ($100), whichever is greater.
      </p>

      <h2 className={h2Class}>6. Termination</h2>
      <p className={pClass}>
        We may suspend or terminate your access to the Service at any time, with or without cause or notice. Upon termination, your right to use the Service ceases immediately. Provisions that by their nature should survive (including intellectual property, disclaimers, and limitation of liability) will survive.
      </p>

      <h2 className={h2Class}>7. Governing law</h2>
      <p className={pClass}>
        These Terms are governed by the laws of the State of Delaware, without regard to conflict of law principles. Any dispute arising from these Terms or the Service shall be resolved in the state or federal courts located in Delaware.
      </p>

      <h2 className={h2Class}>8. Contact</h2>
      <p className={pClass}>
        For questions about these Terms or the Service, please contact us through the contact information provided where the Service is hosted or in the application.
      </p>
    </>
  )
}
