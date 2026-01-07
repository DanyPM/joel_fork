# Test Suite Documentation

This directory contains the comprehensive test suite for the JOEL project.

## Test Structure

### Unit Tests (No External Dependencies)
- `text.utils.test.ts` - Tests for text utility functions (69 tests)
- `date.utils.test.ts` - Tests for date utility functions (17 tests)
- `formatting.utils.test.ts` - Tests for formatting utility functions (35 tests)
- `grouping.test.ts` - Tests for notification grouping logic (23 tests)
- `Commands.test.ts` - Tests for command regex patterns and structure (17 tests)

### Integration Tests (Require MongoDB)
- `People.test.ts` - Tests for People model
- `User.test.ts` - Tests for User model

## Running Tests

### Run Unit Tests Only (Recommended)
```bash
npm run test:unit
```

This runs only the unit tests that don't require external dependencies like MongoDB. This is the fastest way to verify utility functions and business logic.

### Run All Tests (Including Integration Tests)
```bash
npm test
```

This runs all tests including integration tests. Note: Requires MongoDB to be available.

## Test Configuration

- `jest.config.js` - Full test configuration with MongoDB setup
- `jest.config.unit.js` - Unit test configuration (no MongoDB required)

## Coverage

The test suite achieves high coverage for utility functions:
- `date.utils.ts`: 100% coverage
- `text.utils.ts`: 94.59% coverage
- `formatting.utils.ts`: 86.66% coverage
- `grouping.ts`: 34.05% coverage for pure functions
- Command patterns: Comprehensive regex validation

## Test Setup Files

- `globalSetup.ts` - Sets up MongoDB memory server for integration tests
- `globalTeardown.ts` - Tears down MongoDB memory server after tests
- `setupFile.ts` - Connects to MongoDB before tests and disconnects after

## Writing Tests

When adding new tests:

1. **For utility functions**: Add tests to appropriate `*.test.ts` file in this directory
2. **For model tests**: Use the existing model test structure with MongoDB setup
3. **For command patterns**: Add tests to `Commands.test.ts` to validate regex patterns
4. **For notification logic**: Add tests to `grouping.test.ts` for grouping logic
5. **Naming convention**: Use `<module>.test.ts` format
6. **Follow existing patterns**: Check existing tests for examples of good test structure

## Test Best Practices

- Write focused, isolated tests
- Use descriptive test names that explain what is being tested
- Test both success and failure cases
- Mock external dependencies when possible
- Keep tests fast and independent
- For command regex tests, verify both positive and negative cases
