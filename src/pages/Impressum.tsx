import React from 'react';
import { ShieldCheck } from 'lucide-react';

const Impressum: React.FC = () => {
    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <ShieldCheck size={24} />
                </div>
                <h1 className="text-2xl font-bold">Impressum</h1>
            </div>

            <section className="bg-surface border border-border rounded-2xl p-6 space-y-4">
                <div>
                    <h2 className="text-lg font-semibold mb-2">Angaben gemäß § 5 TMG</h2>
                    <p className="text-muted">
                        Daniel Walke<br />
                        Salvador-Allende-Straße 4<br />
                        39126 Magdeburg
                    </p>
                </div>

                <div>
                    <h2 className="text-lg font-semibold mb-2">Kontakt</h2>
                    <p className="text-muted">
                        E-Mail: daniel-walke@t-online.de
                    </p>
                </div>

                <div className="pt-4 border-t border-border">
                    <h2 className="text-sm font-semibold mb-2">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
                    <p className="text-sm text-muted">
                        Daniel Walke<br />
                        Salvador-Allende-Straße 4<br />
                        39126 Magdeburg
                    </p>
                </div>
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-bold">Haftungsausschluss (Disclaimer)</h2>

                <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
                    <div>
                        <h3 className="font-semibold mb-1">Haftung für Inhalte</h3>
                        <p className="text-sm text-muted leading-relaxed">
                            Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-1">Haftung für Links</h3>
                        <p className="text-sm text-muted leading-relaxed">
                            Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-1">Urheberrecht</h3>
                        <p className="text-sm text-muted leading-relaxed">
                            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Impressum;
