"""Profitability regression checks. Uses a dedicated QA vehicle and restores it afterwards.
Run with the project's Python environment; ATLAS_TEST_API defaults to local API.
"""
import datetime as dt
import os
import uuid
import httpx

BASE = os.environ.get('ATLAS_TEST_API', 'http://127.0.0.1:5180')
checks = 0
def req(method, path, status=200, token=None, **kw):
    global checks
    r = httpx.request(method, BASE + path, headers={'Authorization': f'Bearer {token}'} if token else {}, timeout=30, **kw)
    assert r.status_code == status, (method, path, r.status_code, r.text[:200])
    checks += 1
    return r.json() if r.content else None

def main():
    admin = req('POST','/api/auth/login',json={'email':'admin@atlasdrive.ma','password':'AtlasAdmin2026!'})['token']
    user = req('POST','/api/auth/login',json={'email':'client@atlasdrive.ma','password':'AtlasClient2026!'})['token']
    req('GET','/api/admin/profitability',401)
    req('GET','/api/admin/profitability',403,user)
    req('GET','/api/admin/profitability?month=wrong',400,admin)
    req('GET','/api/admin/profitability?month=9999-12',400,admin)
    current = dt.datetime.now(dt.timezone.utc).strftime('%Y-%m')
    bookings = req('GET','/api/bookings',token=admin)
    accepted = [b for b in bookings if b['status'] in ('Confirmed','Active','Completed') and b['createdAt'].startswith(current)]
    for include in (False,True):
        report = req('GET',f'/api/admin/profitability?month={current}&includeTest={str(include).lower()}',token=admin)
        expected = sum(b['total'] for b in accepted if b['paymentStatus'] == 'Paid' or include and b['paymentStatus'] == 'TestPaid')
        assert report['summary']['revenue'] == expected
        assert all(r['balance'] is None or abs(r['balance']-(r['revenue']-r['credit']-r['costs']))<.01 for r in report['rows'])
    fleet = req('GET','/api/vehicles')
    template = {**fleet[0], 'id':0,'brand':'QA Finance','model':uuid.uuid4().hex[:8],'status':'Available','dailyRate':500,'archived':False}
    vehicle = req('POST','/api/admin/vehicles',201,admin,json=template)
    vid = vehicle['id']; path=f'/api/admin/profitability/{vid}'
    def row(month='2026-11'):
        return next(r for r in req('GET',f'/api/admin/profitability?month={month}',token=admin)['rows'] if r['vehicleId']==vid)
    booking_id = None
    try:
        assert row()['balance'] is None, 'missing costs must never become zero'
        profile = dict(vehicleId=vid,purchasePrice=120000,downPayment=24000,annualRate=0,months=60,startMonth='2026-11-01',insurance=500,maintenance=250,otherCosts=150,monthlyPaymentOverride=None,isEstimate=True)
        req('PUT',path,403,user,json=profile)
        req('DELETE',path,403,user)
        req('PUT',path,token=admin,json=profile)
        r=row(); assert r['credit']==1600 and r['costs']==900 and r['balance']==-2500 and r['breakEvenDays']==5 and r['saved']
        assert row('2026-10')['credit']==0
        assert row('2031-10')['credit']==1600
        assert row('2031-11')['credit']==0
        req('PUT',path,token=admin,json={**profile,'annualRate':6.5})
        expected=round(96000*(.065/12)/(1-(1+.065/12)**-60),2)
        assert abs(row()['credit']-expected)<.01
        req('PUT',path,token=admin,json={**profile,'monthlyPaymentOverride':2000,'isEstimate':False})
        assert row()['credit']==2000 and row()['profile']['isEstimate'] is False
        req('PUT',path,token=admin,json={**profile,'downPayment':120000,'insurance':0,'maintenance':0,'otherCosts':0})
        assert row()['credit']==0 and row()['costs']==0 and row()['breakEvenDays']==0
        for changes in ({'months':0},{'annualRate':-1},{'downPayment':130000},{'insurance':-1},{'monthlyPaymentOverride':-1}):
            req('PUT',path,400,admin,json={**profile,**changes})
        public=req('GET',f'/api/vehicles/{vid}')
        assert 'purchasePrice' not in public and 'profile' not in public
        agencies=req('GET','/api/locations')
        agency=next(a for a in agencies if a['city']==template['city'])
        today=dt.date.today(); start=today+dt.timedelta(days=45)
        booking=req('POST','/api/bookings',201,user,json={'vehicleId':vid,'startDate':start.isoformat(),'endDate':(start+dt.timedelta(days=3)).isoformat(),'pickupLocationId':agency['id'],'returnLocationId':agency['id'],'contactEmail':'finance-qa@example.test','insurance':'basic','requestKey':str(uuid.uuid4()),'payment':{'cardholder':'QA Test Only','number':'4242424242424242','expiry':f'12/{(today.year+2)%100:02d}','cvc':'123'}})
        booking_id=booking['id']
        def paid_row(include):
            return next(r for r in req('GET',f'/api/admin/profitability?month={current}&includeTest={str(include).lower()}',token=admin)['rows'] if r['vehicleId']==vid)
        assert paid_row(True)['revenue']==0, 'a prepaid pending request is not revenue'
        req('POST',f'/api/admin/bookings/{booking_id}/review',token=admin,json={'approve':True})
        assert paid_row(True)['revenue']==booking['total'], 'approval immediately recognizes test payment once'
        assert paid_row(False)['revenue']==0, 'real-only mode excludes test payment'
        req('POST',f'/api/bookings/{booking_id}/cancel',token=user)
        assert paid_row(True)['revenue']==0, 'refunded booking removes its revenue'
        booking_id=None
        req('DELETE',f'/api/admin/vehicles/{vid}',204,admin)
        assert row()['archived'], 'archiving does not erase financing obligations'
    finally:
        if booking_id is not None:
            req('POST',f'/api/bookings/{booking_id}/cancel',token=user)
        req('DELETE',path,204,admin)
        if any(v['id']==vid for v in req('GET','/api/vehicles')):
            req('DELETE',f'/api/admin/vehicles/{vid}',204,admin)
    print(f'PASS: {checks} HTTP checks; revenue selection, loan boundaries, annuity, saved overrides, missing data, privacy and roles.')

if __name__=='__main__': main()
