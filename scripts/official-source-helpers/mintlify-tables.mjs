import ts from 'typescript';

export function string(node) {
  if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
    return node.text;
  }
  throw Error('Expected a static Kimi string');
}

export function properties(node) {
  if (!node || !ts.isObjectLiteralExpression(node)) throw Error('Expected Kimi object properties');
  const result = new Map();
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) throw Error('Dynamic Kimi object property');
    const name = ts.isIdentifier(property.name) ? property.name.text : string(property.name);
    if (result.has(name)) throw Error('Duplicate Kimi object property');
    result.set(name, property.initializer);
  }
  return result;
}

export function array(node) {
  if (!node || !ts.isArrayLiteralExpression(node)) throw Error('Expected a static Kimi array');
  return [...node.elements];
}

export function componentProps(node, expected) {
  if (
    !node ||
    !ts.isCallExpression(node) ||
    !ts.isIdentifier(node.expression) ||
    node.expression.text !== '_jsx' ||
    node.arguments.length !== 2 ||
    node.arguments[0].getText() !== expected
  ) {
    throw Error('Unexpected Kimi table component: ' + expected);
  }
  return properties(node.arguments[1]);
}

function paragraphText(node, includeStaticEmphasis) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (
    includeStaticEmphasis &&
    ts.isCallExpression(node) &&
    node.arguments[0]?.getText() === '_components.strong'
  ) {
    return string(componentProps(node, '_components.strong').get('children'));
  }
  return '';
}

export function mintlifyTables(body, { includeStaticEmphasis = false } = {}) {
  const html = new TextDecoder('utf-8', { fatal: true }).decode(body);
  const templates = [
    ...html.matchAll(/<template\s+data-mint="manifest"\s*>([\s\S]*?)<\/template>/g),
  ];
  if (templates.length !== 1) throw Error('Kimi HTML manifest is missing or ambiguous');
  const source = JSON.parse(templates[0][1])?.page?.mdx?.mdxSource?.compiledSource;
  if (typeof source !== 'string') throw Error('Kimi embedded MDX data is missing');

  // The TypeScript parser only constructs a syntax tree. Read static component props and text.
  const ast = ts.createSourceFile('kimi-pricing.js', source, ts.ScriptTarget.Latest, true);
  if (ast.parseDiagnostics.length) throw Error('Invalid Kimi embedded MDX syntax');
  const content = ast.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === '_createMdxContent',
  );
  if (!content) throw Error('Kimi price page content is missing');
  const sectionTables = new Map();
  const paragraphs = [];
  let section;
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.arguments[0]?.getText();
      if (node.expression.text === '_jsx' && name === 'Heading') {
        section = string(componentProps(node, 'Heading').get('id'));
      } else if (node.expression.text === '_jsx' && name === 'DocTable') {
        const tables = sectionTables.get(section) ?? [];
        tables.push(node);
        sectionTables.set(section, tables);
        return;
      } else if (['_jsx', '_jsxs'].includes(node.expression.text) && name === '_components.p') {
        const children = properties(node.arguments[1]).get('children');
        if (children && ts.isArrayLiteralExpression(children)) {
          paragraphs.push(
            array(children)
              .map((node) => paragraphText(node, includeStaticEmphasis))
              .join(''),
          );
        } else if (
          children &&
          (ts.isStringLiteral(children) || ts.isNoSubstitutionTemplateLiteral(children))
        ) {
          paragraphs.push(string(children));
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(content);
  return { sectionTables, paragraphs };
}
