"""Read-only Decimal reference for exported stored META valuation evidence.
Input: JSON array of rows exported with factor_key, value, price, shares,
components, annual_revenue, operating_cash_flow and capex. No DB credentials.
This verifies numerical reproduction only; it never certifies source availability.
"""
import json
import sys
from decimal import Decimal, localcontext


def check(row):
    with localcontext() as ctx:
        ctx.prec = 50
        components = row['components']
        if len(components) != 2 or {x['member'] for x in components} != {
            'us-gaap:CommonClassAMember', 'us-gaap:CommonClassBMember'}:
            raise ValueError('Unsupported share classes')
        if len({x['instant'] for x in components}) != 1:
            raise ValueError('Conflicting share instants')
        counts = [Decimal(str(x['value'])) for x in components]
        if any(x <= 0 or x != x.to_integral_value() for x in counts):
            raise ValueError('Invalid basic shares')
        shares = sum(counts)
        if shares != Decimal(str(row['shares'])):
            raise ValueError('Share components do not reproduce stored total')
        price = Decimal(str(row['price']))
        if not price.is_finite() or price <= 0:
            raise ValueError('Invalid source price')
        equity_proxy = price * shares
        factor = row['factor_key']
        if factor == 'price_sales':
            revenue = Decimal(str(row['annual_revenue']))
            if revenue <= 0:
                raise ValueError('Invalid annual revenue')
            expected = equity_proxy / revenue
        elif factor == 'free_cash_flow_yield':
            expected = (Decimal(str(row['operating_cash_flow'])) -
                        abs(Decimal(str(row['capex'])))) / equity_proxy
        else:
            raise ValueError('Unsupported valuation definition')
        actual = Decimal(str(row['value']))
        error = abs(expected - actual)
        tolerance = max(Decimal('1e-15'), abs(expected) * Decimal('1e-14'))
        if not expected.is_finite() or not actual.is_finite() or error > tolerance:
            raise ValueError('Stored result does not reproduce')
        return {'id': row.get('id'), 'factor': factor,
                'reference': str(expected), 'absoluteError': str(error),
                'reproduced': True, 'scientificallyCertified': False}


if __name__ == '__main__':
    rows = json.load(open(sys.argv[1], encoding='utf-8'))
    if not rows:
        raise ValueError('No exported observations')
    print(json.dumps([check(row) for row in rows], indent=2))
