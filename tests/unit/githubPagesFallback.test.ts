import {
  decodeGithubPagesRoute,
  encodeGithubPagesRoute,
} from '@app/routing/githubPagesFallback';

const origin = 'https://lozest.github.io';

describe('GitHub Pages routing fallback', () => {
  it('encodes a deep route with query and hash under the Pages base', () => {
    const result = encodeGithubPagesRoute(
      {
        origin,
        pathname: '/quiz-tsi-next/questions',
        search: '?type=course',
        hash: '#details',
      },
      '/quiz-tsi-next/',
    );

    expect(result).toBe(
      'https://lozest.github.io/quiz-tsi-next/?__qtsi_route=%2Fquestions%3Ftype%3Dcourse%23details',
    );
  });

  it('decodes local and Pages routes', () => {
    expect(
      decodeGithubPagesRoute({ origin, search: '?__qtsi_route=%2Flogin' }, '/'),
    ).toBe('/login');
    expect(
      decodeGithubPagesRoute(
        {
          origin,
          search: '?__qtsi_route=%2Fquestions%3Ftype%3Dcourse%23details',
        },
        '/quiz-tsi-next/',
      ),
    ).toBe('/quiz-tsi-next/questions?type=course#details');
  });

  it('refuses routes outside the base and external destinations', () => {
    expect(
      encodeGithubPagesRoute(
        { origin, pathname: '/outside/login', search: '', hash: '' },
        '/quiz-tsi-next/',
      ),
    ).toBeNull();
    expect(
      decodeGithubPagesRoute(
        { origin, search: '?__qtsi_route=https%3A%2F%2Fevil.example' },
        '/quiz-tsi-next/',
      ),
    ).toBeNull();
    expect(
      decodeGithubPagesRoute(
        { origin, search: '?__qtsi_route=%2F%2Fevil.example' },
        '/quiz-tsi-next/',
      ),
    ).toBeNull();
  });

  it('does not decode an already restored URL', () => {
    expect(
      decodeGithubPagesRoute({ origin, search: '?other=value' }, '/'),
    ).toBeNull();
  });
});
