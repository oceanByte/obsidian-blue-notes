import {
	cosineSimilarity
} from '../../src/utils/vector-math';

describe('vector-math', () => {
	describe('cosineSimilarity', () => {
		it('should return 1 for identical vectors', () => {
			const a = [1, 2, 3, 4];
			const b = [1, 2, 3, 4];
			expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
		});

		it('should return 0 for orthogonal vectors', () => {
			const a = [1, 0];
			const b = [0, 1];
			expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
		});

		it('should return -1 for opposite vectors', () => {
			const a = [1, 2, 3];
			const b = [-1, -2, -3];
			expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
		});

		it('should handle zero vectors', () => {
			const a = [0, 0, 0];
			const b = [1, 2, 3];
			expect(cosineSimilarity(a, b)).toBe(0);
		});

		it('should throw error for vectors of different lengths', () => {
			const a = [1, 2, 3];
			const b = [1, 2];
			expect(() => cosineSimilarity(a, b)).toThrow('Vectors must have same length');
		});

		it('should calculate correct similarity for unit vectors', () => {
			const a = [1, 0, 0];
			const b = [0.707, 0.707, 0];
			expect(cosineSimilarity(a, b)).toBeCloseTo(0.707, 3);
		});

		it('should handle negative values correctly', () => {
			const a = [1, -1, 1];
			const b = [1, 1, -1];
			const similarity = cosineSimilarity(a, b);
			expect(similarity).toBeGreaterThan(-1);
			expect(similarity).toBeLessThan(1);
		});

		it('should be symmetric', () => {
			const a = [1, 2, 3, 4, 5];
			const b = [5, 4, 3, 2, 1];
			expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
		});
	});

});
