At Napoleon III's banquets, the story goes, the most honoured guests ate with aluminium cutlery while everyone else made do with gold. In the 1850s aluminium could only be made by reacting its chloride with sodium metal, and it was priced like a precious metal. That is odd, because aluminium is the most abundant metal in Earth's crust, about 8% by mass against roughly 5% for iron. Iron had been smelted from its ore with charcoal and a bellows for three thousand years.

Iron has the opposite problem once it is made. Leave a nail in a puddle and within days it is turning back into iron oxide. Bury a steel bar in concrete and it can stay bright for decades. Charcoal that takes iron from its ore but cannot touch alumina; iron that rusts in one kind of water and not in another: both puzzles have the same answer, read off two different maps.

## One quantity, two maps

Every question above is a question about the Gibbs energy of the reaction between a metal and oxygen. If it is negative, the oxide wins; if positive, the metal does. What changes between a blast furnace and a puddle is the variable that sets it.

In a furnace, that variable is temperature, and the oxygen is carried by gases. Harold Ellingham plotted the standard Gibbs energy against temperature in 1944 [1]:

$$\Delta G^\circ = \Delta H^\circ - T\,\Delta S^\circ$$

In water, the oxygen is carried by water molecules and hydrogen ions, and the variable that matters is the electrode potential $E$, the energy of the electrons the metal gives up. The Gibbs energy of an electrochemical reaction and its potential are the same quantity in different units:

$$\Delta G = -nFE$$

where $n$ is the number of electrons transferred and $F$ is the Faraday constant, 96,485 C per mole of electrons. Marcel Pourbaix, a Belgian electrochemist, plotted potential against pH, and his Atlas of Electrochemical Equilibria is still the standard reference for these maps [4]. The first map tells you how to win a metal from its ore. The second tells you how long it will stay won.

## The furnace map: one equation, two slopes

Ellingham wrote every reaction per mole of O₂, which makes the lines comparable: subtract any two and you have a reduction reaction. Over a few hundred kelvin $\Delta H^\circ$ and $\Delta S^\circ$ change little, so each reaction plots as a near-straight line whose slope is $-\Delta S^\circ$. For these reactions the entropy change is dominated by one thing: how many moles of gas appear or disappear, because a gas carries far more entropy than a solid.

$$2\,\mathrm{Fe(s)} + \mathrm{O_2(g)} \rightarrow 2\,\mathrm{FeO(s)}$$

A mole of oxygen gas disappears into a solid. The entropy change is about −138 J K⁻¹ per mole of O₂, so the line climbs as the temperature rises and the oxide becomes less stable. Almost every metal-oxide line climbs at a similar rate, for the same reason.

$$2\,\mathrm{C(s)} + \mathrm{O_2(g)} \rightarrow 2\,\mathrm{CO(g)}$$

Here one mole of gas becomes two. The entropy change is about +175 J K⁻¹ and the line falls: the hotter it gets, the more strongly carbon holds oxygen as CO. Burning carbon all the way to CO₂ takes in one mole of gas and gives one back, so that line is almost flat.

## Why a hotter fire wins

Lower on the diagram means a more stable oxide. At a given temperature, an element whose line lies below another oxide's line can take that oxide's oxygen. At room temperature the CO line sits well above FeO, so carbon cannot reduce iron oxide. But the two lines run towards each other, and with the standard data in the model below they cross at about 1,023 K, or 750 °C [2, 3]. A charcoal fire blown with bellows gets well past that. It is the thermodynamic reason the Iron Age could happen with Iron Age technology.

Copper oxide sits higher still: carbon can take its oxygen at almost any temperature, and the fire is needed mostly for speed. It is one reason copper was smelted thousands of years before iron.

Alumina is the opposite case. Its line lies far below FeO, about −1,060 kJ per mole of O₂ at room temperature against about −500 kJ. The falling carbon line reaches it only at about 2,330 K, roughly 2,050 °C. There the aluminium would be a liquid with a substantial vapour pressure, the alumina would be close to melting, and carbon and aluminium would combine into aluminium carbide. No shaft furnace runs there.

## Try the furnace map

Decide on each answer before you move anything.

1. Set the temperature to 600 °C. Is the carbon-monoxide line above or below FeO? Now drag slowly to the right and stop where carbon starts to win.
2. Find the Al₂O₃ line. Before you drag to the far right, guess whether the carbon line will reach it inside the chart.
3. Go to 900 °C. Is the hydrogen line (2H₂ + O₂ → 2H₂O) above or below FeO? Then switch on the H₂/H₂O scale and raise the ratio of hydrogen to steam until the readout says hydrogen can reduce FeO. How much hydrogen did it take?

{{widget:ellingham}}

The carbon line passes below FeO at about 750 °C, and from there on the readout lists FeO among the oxides carbon can reduce. It meets Al₂O₃ only near the right-hand edge, above 2,000 °C. And the hydrogen line stays above FeO across the range any furnace uses, so hydrogen and steam at equal pressures cannot make iron from wüstite. Hydrogen direct-reduction plants make iron every day all the same; the ratio slider shows why. At 900 °C the model needs about two and a half parts of hydrogen to one of steam.

## Scales that turn a graph into a plant manual

Every line describes an equilibrium at unit activity: pure metal, pure oxide, gases at one bar. Real furnaces never run like that, and the scales printed around a full Ellingham diagram handle the difference. The oxygen-pressure scale gives the partial pressure of O₂ at which a metal and its oxide coexist, from $\Delta G^\circ = RT \ln p_{\mathrm{O_2}}$. For FeO at 1,000 °C it is about $10^{-15}$ bar, which is why iron needs a reducing atmosphere rather than merely a lack of air.

The CO/CO₂ and H₂/H₂O scales do the same job for the gases that actually do the reducing. Read at 900 °C, the model says wüstite turns to iron only in gas with more than about three parts CO to one of CO₂, or about two and a half parts H₂ to one of H₂O. Measured equilibria put both requirements somewhat lower (for CO, roughly two parts to one), because straight lines are an approximation. The message survives the approximation: a gas that is mostly CO₂ or mostly steam will not make iron, however long it stays in the furnace.

> **On the plant floor:** This is why blast-furnace operators analyse the top gas continuously. Hot CO from burning coke rises through the descending ore, and the coke keeps turning CO₂ back into CO wherever the burden is hot enough ($\mathrm{C} + \mathrm{CO_2} \rightarrow 2\,\mathrm{CO}$). The share of CO₂ in the gas leaving the top tells the operator how much of that reducing power the ore actually used. The same scales govern heat-treatment furnaces: an atmosphere with too much CO₂ or steam decarburises or scales steel, and bright-annealing stainless steel needs hydrogen dry enough that even chromium oxide, far down the diagram, is reduced rather than formed.

## Hydrogen's line is flatter than carbon's

$$2\,\mathrm{H_2(g)} + \mathrm{O_2(g)} \rightarrow 2\,\mathrm{H_2O(g)}$$

Three moles of gas become two, so this line rises too, but more gently than the metal-oxide lines: about 110 J K⁻¹ against 138 for FeO. In the model it does not cross FeO until about 1,530 °C, far above where any direct-reduction plant runs. Hydrogen reduction works because nobody runs it one-to-one: a direct-reduction shaft furnace feeds gas that is mostly hydrogen at 800–1,000 °C and carries the water away as it forms. Against carbon monoxide, hydrogen is the weaker reducing gas below about 820 °C and the stronger one above it (about 850 °C with the model's straight-line data). That crossover is the water–gas shift equilibrium, CO + H₂O ⇌ CO₂ + H₂.

Iron and steel production accounts for roughly 7–9% of global CO₂ emissions, and hydrogen does the same chemical job as carbon while leaving water. Sweden's HYBRIT project, a venture of SSAB, LKAB and Vattenfall, has made sponge iron this way in a pilot plant at Luleå, using hydrogen from water electrolysis. The arithmetic is short. For $\mathrm{Fe_2O_3} + 3\,\mathrm{H_2} \rightarrow 2\,\mathrm{Fe} + 3\,\mathrm{H_2O}$, a tonne of iron needs at least 54 kg of hydrogen; at the 50–55 kWh an electrolyser uses per kilogram, that is close to 3 MWh of electricity per tonne before any heating.

## The water map: potential instead of temperature

Once the iron is made, it lives in water: rain, soil moisture, seawater, the pore solution of concrete. Here there is no gas phase to supply oxygen. The reaction that corrodes iron is electrochemical,

$$\mathrm{Fe} \rightarrow \mathrm{Fe^{2+}} + 2e^-$$

and whether it runs depends on the potential of the metal and on how many hydrogen ions are around. A Pourbaix diagram plots the electrode potential, in volts against the standard hydrogen electrode (SHE), up the side and pH along the bottom. Each line is again an equilibrium between two forms of the metal, and the Nernst equation gives its position. For iron dissolving to Fe²⁺:

$$E = -0.440 + \frac{0.0592}{2}\log a_{\mathrm{Fe^{2+}}}$$

The lines come in three shapes, and the shape tells you the chemistry. A horizontal line involves electrons but no hydrogen ions (Fe²⁺/Fe, Fe³⁺/Fe²⁺). A vertical line involves hydrogen ions but no electrons, so pH alone decides it (Fe³⁺ precipitating as Fe₂O₃). A sloping line involves both, falling by 59 mV per pH unit for every hydrogen ion per electron, as in $\mathrm{Fe_3O_4} + 8\,\mathrm{H^+} + 8e^- \rightarrow 3\,\mathrm{Fe} + 4\,\mathrm{H_2O}$, whose line is $E = -0.085 - 0.0591\,\mathrm{pH}$ [4].

Two more lines, dashed on every Pourbaix diagram, belong to water itself. Below the lower one water is reduced and hydrogen gas forms; above the upper one it is oxidised to oxygen. They sit 1.23 V apart at every pH, and most natural waters and soils live between them.

## Immunity, corrosion, passivation

Pourbaix divided his maps into three kinds of territory. Where the metal itself is the stable form, it is **immune**: it cannot corrode, whatever else happens. Where a dissolved ion is stable, the metal **corrodes**. Where a solid oxide or hydroxide is stable, it **may passivate**: a film forms that can slow corrosion to almost nothing, if the film is dense and stays put.

"Dissolved" needs a number, and the convention is an activity of $10^{-6}$ mol/L. If iron cannot dissolve to even a millionth of a mole per litre, it is not going anywhere in a human lifetime. The convention matters, because every line involving an ion moves when you change it, and the model lets you do exactly that.

## Try the water map

1. Start at pH 7 and 0 V. What is stable there? Now lower the potential until the readout says iron is immune. Where did it change, and is that below the hydrogen line?
2. Move to pH 1 and sweep the potential up from −1.5 V. Is there any potential at which a solid oxide protects iron in acid this strong?
3. Concrete pore water sits at about pH 13. Put the cursor there at −0.5 V. Then drop the pH to 8, roughly where concrete ends up once carbon dioxide from the air has neutralised it, and keep the potential where it is. What changes?
4. Slide the corrosion threshold from 10⁻⁶ down to 10⁻⁸ mol/L. Which fields grow, and why does it make sense that they do?

{{widget:pourbaix}}

Iron becomes immune only below about −0.62 V at 10⁻⁶ in neutral and acid water, which is well below the hydrogen line: in contact with water, iron is always thermodynamically able to corrode. At pH 1 there is no solid field at any potential: iron goes from immune straight to Fe²⁺ and then Fe³⁺, so strong acid simply dissolves it. At pH 13 and −0.5 V the stable form is an oxide, Fe₂O₃, which is why steel in sound concrete passivates. At pH 8 the same potential lies in the Fe²⁺ field, and carbonated concrete starts to rust its reinforcement. Lowering the threshold widens every field that ends in a dissolved ion, because a metal that only has to reach a smaller concentration has an easier job.

## Cathodic protection is a move straight down the map

If corrosion is a matter of where the metal sits on the map, the cure is to move it. Cathodic protection drives the potential of a pipeline, a ship's hull or an offshore jacket downwards, towards the immunity field, either with sacrificial anodes of zinc, aluminium or magnesium, which corrode in its place, or with an impressed current from a rectifier. The pipeline industry's long-standing criterion of −0.85 V against a copper/copper-sulphate reference (about −0.53 V vs SHE) sits close to the iron immunity line rather than exactly on it. It is an empirical rule, and it works partly because the cathodic reaction makes the steel surface alkaline, nudging it towards the oxide fields.

The opposite move exists too. Anodic protection raises the potential of carbon or stainless steel into a passive field and holds it there, which is how some tanks of concentrated sulfuric acid are kept intact.

> **In the lab:** A Pourbaix diagram is a prediction you can test in an afternoon. Measure the open-circuit potential of a mild-steel coupon against an Ag/AgCl reference in buffers at pH 2, 7 and 12 (deaerate one set with nitrogen), then convert each reading to SHE by adding about 0.21 V for a 3 M KCl electrode. The model's readout does the conversion in the other direction. Where the measured potential falls in the Fe²⁺ field the coupon dulls, and in the aerated cell the solution turns yellow-brown as dissolved iron oxidises; where it falls in an oxide field the surface stays bright. Wear gloves and eye protection with the acid buffer, and dispose of iron-containing solutions as your laboratory requires.

## What the water map cannot see

A Pourbaix diagram is equilibrium thermodynamics at 25 °C, and it is silent about speed. It says that iron in neutral, aerated water can form Fe₂O₃; it cannot say whether the film will be a tight passive layer or loose red rust. The iron–water diagram also knows nothing about chloride. In seawater, chloride ions break passive films locally and cause pitting at potentials where the diagram promises safety, which is why stainless steels are ranked by pitting-resistance tests and not by their Pourbaix diagrams alone. Complexing agents (ammonia for copper, cyanide for gold) open corrosion fields that the plain metal–water diagram does not show, and temperature shifts every line. Treat the diagram as the first question, not the last.

## Where the two maps meet

The two diagrams are more than analogous: at 25 °C they contain the same numbers. Write the oxide's reduction in water per mole of O₂, $2\,\mathrm{MO} + 4\,\mathrm{H^+} + 4e^- \rightarrow 2\,\mathrm{M} + 2\,\mathrm{H_2O}$, and the Ellingham value converts directly into the oxide/metal potential at pH 0:

$$E^\circ = \frac{\Delta G^\circ_{\text{Ellingham}} + 474\ \text{kJ}}{4F}$$

where 474 kJ is the Gibbs energy of forming two moles of liquid water. Put in the Cu₂O line, high on the Ellingham diagram, and you get +0.47 V, exactly the Cu₂O/Cu line in Pourbaix's atlas, above the hydrogen line. That is why copper does not dissolve in acid without an oxidiser. Put in alumina, far down, and you get about −1.5 V: thermodynamically aluminium should react with water readily, and only its thin oxide film stops it. Put in liquid water itself and you get exactly zero. The hydrogen line on the water map is the water line from the furnace map, translated into volts.

> **For the specialist:** The Ellingham construction uses ΔG° per mole of O₂ and $RT\ln K = -\Delta G^\circ$; its $p_{\mathrm{O_2}}$, CO/CO₂ and H₂/H₂O nomographs solve that expression, with origins at O (ΔG° = 0, T = 0) and at the 0 K intercepts of the 2CO + O₂ → 2CO₂ and 2H₂ + O₂ → 2H₂O lines. Wüstite is unstable below about 570 °C, where Fe₃O₄ and Fe are the equilibrium pair, so the FeO line there is a convenience. The Pourbaix model uses Pourbaix's own iron data with hematite and magnetite as the solids [4]; with hydroxides (Fe(OH)₂, Fe(OH)₃) instead, the passive fields shrink, which is closer to what a freshly corroding surface sees. Both maps assume unit activity for solids and water, ideal gases, and a single temperature. For numbers you will rely on, go to NIST-JANAF [3] or a critically evaluated aqueous database rather than straight-line fits.

## Both maps end at an electrode

Both maps end by pointing at electrochemistry. Aluminium was never made cheaply by any furnace; in 1886 Charles Martin Hall and Paul Héroult independently dissolved alumina in molten cryolite at about 960 °C and pulled the metal out with an electric current. Carbon still ends up holding the oxygen, as CO₂ at the anode, but electricity pays the thermodynamic bill that heat could not. Low-carbon iron now heads the same way: hydrogen from electrolysers, or molten oxide electrolysis, which passes current through iron ore dissolved in a molten oxide at around 1,600 °C and releases oxygen at the anode with no carbon at all.

And the electrolysers making that hydrogen are a Pourbaix problem. The anode of a proton-exchange-membrane electrolyser runs in acid at more than 1.5 V, far above the oxygen line, a corner of the water map where almost every metal dissolves. That is why those anodes use iridium oxide. Titanium survives there by passivating, but its oxide conducts poorly, so titanium parts are coated with platinum or gold. Databases such as the Materials Project now compute Pourbaix diagrams for thousands of compounds [5], so a candidate catalyst can be screened before anyone makes it. The steel of the next few decades may well be decided by a material that survives on the top edge of one map, so that iron can be made at the bottom of the other.
