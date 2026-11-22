"""Offline terminal version of the Newham working-age Council Tax Reduction estimator."""

import re
import sys
from fractions import Fraction
from typing import NamedTuple


# Newham 2026–27 billing booklet, page 10, and Council Tax Reduction Scheme.
YEAR = "2026-27"
DAYS_IN_YEAR = 365
ANNUAL_CHARGES = {
    "A": Fraction("1296.15"), "B": Fraction("1512.18"),
    "C": Fraction("1728.20"), "D": Fraction("1944.23"),
    "E": Fraction("2376.28"), "F": Fraction("2808.33"),
    "G": Fraction("3240.38"), "H": Fraction("3888.46"),
}
ZERO = Fraction(0)
MAXIMUM_RATE = Fraction(7, 10)
WEEKLY_TAPER = Fraction(1, 4)
PENSION_SHARE = Fraction(1, 2)
WEEKLY_FACTORS = {
    "weekly": Fraction(1), "every 2 weeks": Fraction(1, 2),
    "every 4 weeks": Fraction(1, 4), "monthly": Fraction(12, 52),
}
MONEY_PATTERN = re.compile(r"(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.[0-9]{1,2})?")
UNKNOWN_ANSWERS = {"unknown", "not sure", "?"}


class InputError(ValueError):
    """The supplied answers cannot support an estimate."""


class BenefitRule(NamedTuple):
    name: str
    countable: bool | None
    guidance: str = ""


# None identifies a benefit that needs a separate assessment in the web calculator.
LEGACY_BENEFIT_GUIDANCE = "This award can change how earnings and other income are assessed."
BENEFITS = (
    BenefitRule("Carer’s Allowance", True),
    BenefitRule("Maternity Allowance", True),
    BenefitRule("New Style / contribution-based Jobseeker’s Allowance", True),
    BenefitRule("Personal Independence Payment (PIP)", False),
    BenefitRule("Disability Living Allowance (DLA)", False),
    BenefitRule("Armed Forces Independence Payment (AFIP)", False),
    BenefitRule("Attendance Allowance", False),
    BenefitRule("Child Benefit", False),
    BenefitRule("Housing Benefit", False),
    BenefitRule("Guardian’s Allowance", False),
    BenefitRule("Universal Credit", None, "Newham also needs the DWP income assessment and award details."),
    BenefitRule("Income Support", None, LEGACY_BENEFIT_GUIDANCE),
    BenefitRule("Income-based Jobseeker’s Allowance", None, LEGACY_BENEFIT_GUIDANCE),
    BenefitRule("Income-related Employment and Support Allowance", None, LEGACY_BENEFIT_GUIDANCE),
    BenefitRule("New Style / contributory Employment and Support Allowance", None,
                "Newham may need the award before deductions and details of exempt work."),
    BenefitRule("Statutory pay from an employer", None,
                "Include employer statutory pay once in gross earnings and start the estimate again."),
    BenefitRule("Other or unsure", None, "Identify the payment before estimating its effect on Council Tax."),
)


class Estimate(NamedTuple):
    percentage: Fraction
    income_gap: Fraction


def weekly_net_pay(gross, tax, national_insurance, pension, frequency):
    if tax + national_insurance + pension > gross:
        raise InputError("Tax, National Insurance and pension contributions together must fit within gross pay.")
    return (gross - tax - national_insurance - PENSION_SHARE * pension) * WEEKLY_FACTORS[frequency]


def calculate(band, net_pay, benefits, applicable_amount, disregard):
    if applicable_amount is None:
        raise InputError("Enter the weekly applicable amount before estimating a reduction.")
    if disregard is None and net_pay > ZERO:
        raise InputError("Enter the weekly earnings disregard before estimating a reduction.")

    assessable_income = max(ZERO, net_pay - (disregard or ZERO))
    for rule, payment, frequency in benefits:
        if rule.countable is None:
            raise InputError(f"{rule.name} needs a separate assessment. {rule.guidance}")
        if rule.countable:
            assessable_income += payment * WEEKLY_FACTORS[frequency]

    annual_charge = ANNUAL_CHARGES[band]
    weekly_charge = annual_charge * 7 / DAYS_IN_YEAR
    income_gap = assessable_income - applicable_amount
    weekly_reduction = max(ZERO, weekly_charge * MAXIMUM_RATE - max(ZERO, income_gap) * WEEKLY_TAPER)
    annual_reduction = weekly_reduction * DAYS_IN_YEAR / 7
    return Estimate(annual_reduction / annual_charge * 100, income_gap)


def two_decimal_places(value):
    """Round a non-negative fraction to two places, with exact half-up rounding."""
    whole, remainder = divmod(value.numerator * 100, value.denominator)
    rounded = whole + (remainder * 2 >= value.denominator)
    units, hundredths = divmod(rounded, 100)
    return f"{units:,}.{hundredths:02}"


def format_result(estimate):
    positive = estimate.percentage > ZERO
    percentage = two_decimal_places(estimate.percentage)
    if positive and percentage == "0.00":
        percentage = "<0.01"

    if estimate.income_gap > ZERO:
        excess = two_decimal_places(estimate.income_gap).removesuffix(".00")
        gap = "less than £0.01" if excess == "0" else f"£{excess}"
        reasons = [f"Weekly assessable income exceeds the applicable amount by {gap}."]
        reasons.append("A positive reduction remains after the income taper." if positive
                       else "The income taper cancels the full estimated reduction.")
    elif estimate.income_gap == ZERO:
        reasons = ["Weekly assessable income equals the applicable amount.",
                   "This estimate applies no taper at equality. Confirm the treatment with Newham Council."]
    else:
        reasons = ["Weekly assessable income is below the applicable amount.",
                   "The maximum modelled reduction applies."]

    return "\n".join(["Yes" if positive else "No", f"{percentage}% estimated reduction",
                      *(f"- {reason}" for reason in reasons)])


def ask_choice(question, choices, *, default=None):
    while True:
        answer = input(f"{question} ").strip().lower()
        if answer in UNKNOWN_ANSWERS:
            raise InputError("The current question needs an answer before an estimate is possible.")
        if not answer and default is not None:
            return default
        if answer in choices:
            return choices[answer]
        print("Choose one of the listed options, or enter 'unknown' if you are unsure.")


def ask_yes_no(question):
    return ask_choice(f"{question} [y/n]", {"y": True, "yes": True, "n": False, "no": False})


def ask_money(label, *, blank=None, required=True):
    while True:
        answer = input(f"{label} ").strip()
        if answer.lower() in UNKNOWN_ANSWERS:
            if not required:
                return blank
            raise InputError(f"A known figure is required for {label.rstrip(':').lower()}.")
        if not answer and (blank is not None or not required):
            return blank
        amount = answer.removeprefix("£").strip()
        if MONEY_PATTERN.fullmatch(amount):
            try:
                return Fraction(amount.replace(",", ""))
            except ValueError:
                pass
        print("Enter a non-negative amount in pounds with up to two decimal places, or 'unknown'.")


def read_pay():
    frequency = ask_choice("Pay frequency [weekly/monthly, default weekly]:",
                           {"w": "weekly", "weekly": "weekly", "m": "monthly", "monthly": "monthly"},
                           default="weekly")
    print("Use amounts from the same pay period. Leave deductions blank if none were taken.")
    print("Use gross pay after any salary sacrifice and leave the sacrificed amount out of pension contributions.")
    while True:
        gross = ask_money("Gross earnings (enter 0 if none):")
        tax = ask_money("Income Tax deducted:", blank=ZERO)
        ni = ask_money("Employee National Insurance:", blank=ZERO)
        pension = ask_money("Qualifying employee pension contributions:", blank=ZERO)
        try:
            return weekly_net_pay(gross, tax, ni, pension, frequency)
        except InputError as error:
            print(f"{error} Re-enter the pay figures.")


def read_benefits():
    payments = []
    has_benefit = ask_yes_no("Do you receive any benefits?")
    while has_benefit:
        choices = {str(index): rule for index, rule in enumerate(BENEFITS, start=1)}
        for number, rule in choices.items():
            print(f"  {number}. {rule.name}")
        rule = ask_choice("Benefit number:", choices)
        if rule.countable is None:
            raise InputError(f"{rule.name} needs a separate assessment. {rule.guidance}")
        payment = ask_money("Gross benefit payment before recovery deductions:")
        frequency = ask_choice(
            "Payment frequency [1 weekly, 2 every 2 weeks, 3 every 4 weeks, 4 monthly]:",
            {str(index): name for index, name in enumerate(WEEKLY_FACTORS, start=1)},
        )
        payments.append((rule, payment, frequency))
        has_benefit = ask_yes_no("Add another benefit?")
    return payments


def main():
    print("Newham Council Tax Reduction estimate")
    print("This model covers working-age Newham cases on the full band charge, with no discounts or non-dependant deductions.")
    print("It covers employed earnings and supported benefits. Newham Council determines the actual award.")
    print("Enter 'unknown' if you are unsure of a required answer.")
    try:
        if not ask_yes_no("Does that describe the case you want to estimate?"):
            raise InputError("This case needs an assessment beyond the working-age Newham model.")

        year = input(f"Financial year [{YEAR}]: ").strip().replace("–", "-").replace("/", "-") or YEAR
        if year != YEAR:
            raise InputError(f"This calculator covers {YEAR}. Confirm the year or use an assessment for the relevant year.")
        band = ask_choice("Council Tax band [A-H]:", {band.lower(): band for band in ANNUAL_CHARGES})
        net_pay = read_pay()
        benefits = read_benefits()
        print("The applicable amount is the weekly income allowance for the circumstances you are modelling.")
        applicable_amount = ask_money("Applicable amount per week:")
        print("The earnings disregard is the part of net weekly pay that the scheme leaves out of income.")
        disregard_prompt = "Earnings disregard per week:" if net_pay > ZERO else "Earnings disregard per week (optional):"
        disregard = ask_money(disregard_prompt, required=net_pay > ZERO)
        print(f"\n{format_result(calculate(band, net_pay, benefits, applicable_amount, disregard))}")
        return 0
    except InputError as error:
        print(f"\nCannot estimate. {error}", file=sys.stderr)
        return 2
    except EOFError:
        print("\nCannot estimate. Input ended before the required answers were supplied.", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("\nCancelled.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")
    sys.exit(main())
