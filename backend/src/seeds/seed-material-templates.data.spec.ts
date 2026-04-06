import { VisaCaseApplicationCategory } from '../common/constants/enums';
import { MATERIAL_TEMPLATE_BASE_SEEDS } from './seed-material-templates.data';

describe('MATERIAL_TEMPLATE_BASE_SEEDS', () => {
  it('为每个 VisaCaseApplicationCategory 枚举值提供唯一一条基础种子模板', () => {
    const seededCaseTypes = MATERIAL_TEMPLATE_BASE_SEEDS.map((s) => s.caseType);
    const unique = new Set(seededCaseTypes);
    expect(unique.size).toBe(seededCaseTypes.length);

    const enumValues = Object.values(VisaCaseApplicationCategory);
    for (const ct of enumValues) {
      expect(unique.has(ct)).toBe(true);
    }
    expect(MATERIAL_TEMPLATE_BASE_SEEDS.length).toBe(enumValues.length);
  });
});
