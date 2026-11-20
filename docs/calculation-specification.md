# Mathematical specification

## Scope and input contract

The model covers one steady, working-age Newham scenario from 1 April 2026 to 31 March 2027. The liability is the full band charge for the whole year. Supply average gross earnings and deductions in the same pay period. Blank payroll entries represent zero. Supply qualifying employee-paid occupational pension contributions from those earnings. Use gross earnings after any salary sacrifice and exclude the sacrificed contribution from the employee pension input.

The caller must supply `weeklyApplicableAmount` as a pounds string. The empty string means the amount is unknown. `weeklyEarningsDisregard` is a separate amount supplied in weekly pounds after establishing the relevant Schedule 7 rules. If net earnings are positive and the disregard is unknown, the earnings and reduction estimates are unavailable. At zero net earnings the assessable earnings are zero. An explicit `"0"` can be used for either parameter when defining a scenario. Monetary inputs are non-negative, accept up to two decimal places, and may use UK thousands separators. Benefit inputs are gross recurring awards before recovery deductions. For this payroll-only model, the three payroll deductions combined must fit within gross pay for the period.

## Variables and formulas

Money is in GBP. `k` converts an individual regular payment period to a week. The monthly income conversion uses `12 / 52`, separately from the daily basis for Council Tax liability.

| Symbol | Definition |
| --- | --- |
| `CT` | Published annual charge for the selected Newham band and year |
| `d` | Days in the financial year, 365 for 2026–27 |
| `W` | Standard liability for seven days |
| `G`, `T`, `NI`, `P` | Gross employment earnings, Income Tax, employee primary Class 1 National Insurance, and qualifying employee workplace pension contribution for one pay period |
| `r` | Pension deduction proportion, 0.50 |
| `k` | Payment-to-week multiplier. Weekly `1`, fortnightly `1/2`, four-weekly `1/4`, calendar monthly `12/52`. Employment accepts weekly and monthly. |
| `D` | Supplied weekly earnings disregard |
| `E` | Weekly assessable earnings |
| `B_j`, `k_j`, `C_j` | Gross payment, weekly multiplier, and weekly countable amount for benefit `j` |
| `B`, `I` | Total countable benefits per week and total assessable income per week |
| `A` | Explicitly supplied weekly applicable amount |
| `p`, `N`, `M` | Maximum proportion `0.70`, assumed weekly non-dependant deduction `£0`, and weekly maximum potential reduction |
| `X`, `t`, `Q` | Weekly excess income above `A`, taper `0.25`, and weekly reduction deducted by the taper |
| `CTR`, `R` | Modelled weekly and annual Council Tax Reduction |
| `Y`, `L` | Estimated annual and average monthly Council Tax payable |

```text
W            = CT × 7 / d
Pension cut  = r × P
Net pay      = G − T − NI − r × P
Weekly net   = Net pay × k
E            = max(0, Weekly net − D)
C_j          = B_j × k_j for countable awards, or 0 for disregarded awards
B            = sum(C_j)
I            = E + B
M            = max(0, p × W − N)
X            = max(0, I − A)
Q            = t × X
CTR          = max(0, M − Q)
R            = CTR × d / 7
Y            = max(0, CT − R)
L            = Y / 12
```

For `I = A` the supplied scenario formula gives a zero taper deduction. The scheme text describes Class D with “less than” and Class E with “greater than” in paragraphs 16 and 17. The interface flags equality as a modelling convention for Newham to confirm. With non-negative excess income the floor on `M` is algebraically equivalent to putting just one floor around the brief’s reduction formula.

The engine represents decimal input amounts and conversion factors as exact BigInt fractions. Intermediate money values stay unrounded through the annual and monthly conversions. The bill and reduction summary rounds each output independently to two decimal places, with half-pennies rounded up. The calculation summary displays positive amounts that would round to zero as `< £0.01`. The expanded calculation shows non-penny intermediates to six decimal places with `≈`. Exact fractions remain available to TypeScript callers. Display rounding is a calculator convention. The scheme’s general half-penny rule applies when the scheme prescribes rounding. [Scheme paragraph 2(2), p. 30](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=30)

## Source-to-formula mapping

References below are PDF page numbers. The final scheme was approved on 26 February 2026 and came into force on 1 April 2026. [Newham Council Tax Reduction Scheme 2026](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026)

| Implemented rule | Official basis |
| --- | --- |
| `CT` | Use the total charge, including the GLA precept, from the published band table. [Council Tax bands and costs](https://www.newham.gov.uk/council-tax/council-tax-bands-charges-appeals/1) |
| `W` and `p` | Paragraph 29(1) uses the annual liability divided by the number of days and applies 70% to the working-age amount. Multiply the daily amount by 7 for this model. [Scheme p. 69](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=69) · [Newham CTR guidance](https://www.newham.gov.uk/ctrhowmuch) |
| `N` | The full scheme applies the appropriate non-dependant deduction. The model uses £0 as an assumption. [Scheme p. 69](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=69) · [Newham deduction guidance](https://www.newham.gov.uk/ctrhowmuch) |
| `k` and `k_j` | Paragraphs 47 and 49 cover assessment periods. Paragraph 50(1) uses the weekly amount, `12/52` for a month, or `7` divided by the covered days for another multiweek period. [Scheme pp. 113–115](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=113) |
| `G − T − NI − rP` | Paragraph 51 defines employed earnings. Paragraph 52(3)(a)–(b) deducts Income Tax, employee primary Class 1 NI and half the applicant’s occupational pension contributions. [Scheme pp. 115–118](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=115) |
| `D` and `E` | Paragraph 52(2) points to Schedule 7 for relevant net earnings disregards. The caller supplies the outcome of those rules. [Scheme paragraph 52, p. 117](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=117) · [Schedule 7, from p. 279](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=279) |
| `B` and `I` | Paragraphs 49 and 54 assess other income over the relevant period, use the gross award before recovery and apply Schedule 8 disregards. See the supported benefit mappings below. [Scheme p. 114](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=114) · [Scheme p. 120](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=120) |
| `A` | Paragraph 26 and Schedule 3 establish the standard working-age applicable amount. Paragraphs 27 and 28 cover other cases. This model accepts a caller-supplied weekly figure. [Scheme pp. 65–68](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=65) · [Schedule 3, from p. 241](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=241) |
| `X`, `t`, `Q`, `CTR` | Paragraphs 16–17 define the below- and above-allowance classes. Paragraph 17(f) gives a daily taper of `3 4/7%` of weekly excess. Its exact weekly equivalent is `7 × (25/7)% = 25%`. Paragraph 32(2)–(3) sets the daily award. [Scheme pp. 45–46](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=45) · [Scheme p. 85](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=85) |
| `R`, `Y`, `L` | Apply the same scenario across the financial year, subtract the annualised reduction from the standard charge, and divide by 12 for a monthly average. The council bill specifies instalments. |

### Supported benefit entries

Each row uses the working-age rules for the named award. A disregarded award can still affect other parts of a real assessment, such as premiums. An unresolved payment makes the total income and reduction unavailable. The breakdown still shows each payment’s weekly value and classification.

| Awards | Treatment | Source |
| --- | --- | --- |
| Carer’s Allowance, Maternity Allowance, New Style or contribution-based Jobseeker’s Allowance | Gross recurring award is countable in the ordinary working-age route. Assess any premium or earnings disregard separately. | [Paragraph 54(1)–(3), p. 120](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=120) · [Schedule 8 paragraph 7, p. 288](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=288) · [Carer premium, Schedule 3 paragraph 14, p. 254](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=254) |
| Personal Independence Payment, Disability Living Allowance, Armed Forces Independence Payment, Attendance Allowance | Payment disregarded. | [Schedule 8 paragraphs 10 and 13, p. 289](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=289) |
| Housing Benefit, Guardian’s Allowance, Child Benefit | Payment disregarded. | [Schedule 8 paragraph 41, p. 301](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=301) · [Paragraph 51, p. 303](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=303) · [Paragraph 65, p. 306](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=306) |
| Universal Credit | Requires further assessment. Newham uses the DWP income assessment, UC entitlement, and maximum award, subject to scheme adjustments. A single payment amount is insufficient. | [Paragraph 28, p. 68](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=68) · [Paragraph 37, pp. 90–91](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=90) |
| Income Support, income-based Jobseeker’s Allowance, income-related Employment and Support Allowance | Requires further assessment. The scheme sets broader income and earnings disregards for these cases. | [Schedule 7 paragraph 14, p. 285](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=285) · [Schedule 8 paragraph 7, p. 288](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=288) |
| New Style or contributory Employment and Support Allowance | Requires further assessment. Scheme rules can use the amount before specific reductions and apply an exempt-work earnings disregard. | [Paragraph 54(4), p. 120](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=120) · [Schedule 7 paragraph 12, pp. 283–285](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=283) |
| Employer statutory pay | Requires further assessment when entered as a benefit. Include it once in gross employment earnings and remove the benefit row. | [Paragraph 51(1)(j), p. 116](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=116) |
| Other or unsure | Requires further assessment to identify the payment and its rule. | [Paragraphs 49 and 54](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=114) |

## Verification examples

For Band F with no countable income and a synthetic `A = £100`, the model gives weekly liability of about £53.858384 and weekly reduction of about £37.700868. The display shows an annual reduction of £1,965.83, an annual bill of £842.50 and a monthly average of £70.21. At `I = £120` the £20 excess reduces the award by £5 a week, giving an annual bill of £1,103.21 and a monthly average of £91.93.

Newham’s ready reckoner provides an independent cutoff for a working-age couple on the Band C standard charge. With the independently supplied £150.15 applicable amount, the exact cutoff is £242.9519726… per week. A test verifies a positive unrounded reduction at the published £242.95 and zero at £242.96. The booklet publishes rounded income cutoffs, so this validates the taper and liability together. [Newham billing booklet 2026/27, p. 29](https://www.newham.gov.uk/downloads/file/10583/billing-booklet-2026-27#page=29) · [Social Security Benefits Up-rating Order 2026, Schedule 4](https://www.legislation.gov.uk/uksi/2026/148/schedule/4/made)

## Missing rules for a full eligibility assessment

- Household and family composition, including partner income, child allowances, premiums, childcare costs, derived earnings disregards and calculation of the applicable amount. This includes checking whether benefit receipt changes any of those rules. [Scheme Parts 5–7 and 10](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=55)
- Actual liability, including non-dependants and their exemptions, single-person or other discounts, joint billing liability, student exemptions, and occupancy or liability changes. [Scheme paragraphs 16–17, 29 and 30B](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=69)
- Pension-age, capital and tariff income, residence, temporary absence, student eligibility, and the other qualifying conditions or exclusions for a claim. [Scheme Parts 5, 10 and 11](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=40)
- Universal Credit assessment data, special and unidentified awards, earnings averaging across irregular pay, self-employment, separately paid qualifying personal pensions under paragraph 52(3)(c)–(5), other assessable income, and arrears or lump sums. [Scheme Part 10](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=86)
- Actual assessment periods, effective dates, changes during the year, award administration and the council’s instalment schedule. [Scheme Parts 12–15](https://www.newham.gov.uk/downloads/file/10753/council-tax-reduction-scheme-2026#page=186)

The interface reports only **Potential reduction indicated**, **No reduction under the selected assumptions**, or **Insufficient information for an eligibility estimate**. The status follows the exact modelled amount before display rounding. Newham Council assesses actual entitlement and determines the final award.
