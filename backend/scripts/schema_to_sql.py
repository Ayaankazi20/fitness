#!/usr/bin/env python3
"""Emit the INITIAL migration DDL from prisma/schema.prisma (offline fallback). Later migrations are hand-written/prisma-generated; do not re-run this after the init migration is applied."""
import re, sys
src = open('prisma/schema.prisma').read()
enums = {m.group(1): m.group(2).split() for m in re.finditer(r'enum (\w+) \{\n(.*?)\n\}', src, re.S)}
models = {}
for m in re.finditer(r'model (\w+) \{\n(.*?)\n\}', src, re.S):
    models[m.group(1)] = m.group(2).split('\n')
def tname(model):
    for l in models[model]:
        x = re.match(r'\s*@@map\("(\w+)"\)', l)
        if x: return x.group(1)
def snake(n): return n
tmap = {'String':'TEXT','Int':'INTEGER','Float':'DOUBLE PRECISION','Boolean':'BOOLEAN','DateTime':'TIMESTAMP(3)','Json':'JSONB'}
out = []
for e, vals in enums.items():
    out.append('CREATE TYPE "%s" AS ENUM (%s);' % (e, ', '.join("'%s'" % v for v in vals)))
fks, idx = [], []
for mname, lines in models.items():
    t = tname(mname); cols = []; uniq = []
    for l in lines:
        l = l.strip()
        if not l or l.startswith('//') : continue
        if l.startswith('@@unique'):
            f = re.search(r'\[(.*?)\]', l).group(1).split(', ')
            uniq.append(f); continue
        if l.startswith('@@index'):
            f = re.search(r'\[(.*?)\]', l).group(1).split(', ')
            idx.append((t, f, False)); continue
        if l.startswith('@@'): continue
        m = re.match(r'(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)', l)
        fname, ftype, arr, opt, rest = m.groups(); rest = rest or ''
        if '@relation' in rest:
            r = re.search(r'fields: \[(\w+)\], references: \[(\w+)\](?:, onDelete: (\w+))?', rest)
            if r:
                local, ref, od = r.groups()
                cname = re.search(r'@map\("(\w+)"\)', ''.join(x for x in lines if re.match(r'\s*%s\s' % local, x))) 
                lc = cname.group(1) if cname else local
                refm = ftype
                rc = ref
                nulls = any(re.match(r'\s*%s\s+\w+\?' % local, x) for x in lines)
                act = {'Cascade':'CASCADE','SetNull':'SET NULL'}.get(od, 'RESTRICT')
                fks.append((t, lc, tname(refm), rc, act))
            continue
        if ftype in models: continue
        col = re.search(r'@map\("(\w+)"\)', rest); col = col.group(1) if col else fname
        if ftype in enums: sql = '"%s"' % ftype
        elif '@db.Uuid' in rest: sql = 'UUID'
        elif '@db.Date' in rest: sql = 'DATE'
        else: sql = tmap[ftype]
        if arr: sql += '[]'
        notnull = '' if (opt or arr) else ' NOT NULL'
        d = ''
        dm = re.search(r'@default\((.*?)\)(?:\s|$)', rest + ' ')
        if dm:
            v = dm.group(1)
            if v == 'uuid()': d = ''
            elif v == 'now()': d = ' DEFAULT CURRENT_TIMESTAMP'
            elif v in ('true','false'): d = ' DEFAULT ' + v
            elif re.match(r'^[\d.]+$', v): d = ' DEFAULT ' + v
            else: d = " DEFAULT '%s'" % v
        cols.append((fname, col, '"%s" %s%s%s' % (col, sql, notnull, d), '@id' in rest, '@unique' in rest))
    pk = [c[1] for c in cols if c[3]]
    body = ',\n    '.join([c[2] for c in cols] + ['CONSTRAINT "%s_pkey" PRIMARY KEY ("%s")' % (t, pk[0])])
    out.append('CREATE TABLE "%s" (\n    %s\n);' % (t, body))
    for c in cols:
        if c[4]: idx.append((t, [c[1]], True))
    colmap = {c[0]: c[1] for c in cols}
    for u in uniq: idx.append((t, [colmap.get(x, x) for x in u], True))
    # index fields given by prisma names -> map
    idx = [(a, [colmap.get(x, x) if a == t else x for x in b], c) for a, b, c in idx]
for t, f, u in idx:
    name = '%s_%s_%s' % (t, '_'.join(f), 'key' if u else 'idx')
    out.append('CREATE %sINDEX "%s" ON "%s"(%s);' % ('UNIQUE ' if u else '', name, t, ', '.join('"%s"' % x for x in f)))
for t, lc, rt, rc, act in fks:
    out.append('ALTER TABLE "%s" ADD CONSTRAINT "%s_%s_fkey" FOREIGN KEY ("%s") REFERENCES "%s"("%s") ON DELETE %s ON UPDATE CASCADE;' % (t, t, lc, lc, rt, rc, act))
print('\n\n'.join(out))
