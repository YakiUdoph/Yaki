# Competitor and prior-art audit

Assessment date: 2026-10-18.

This review exists to keep Yaki's claims honest. Address correction, batch cleansing, candidate lists, and human review already exist in mature products; Yaki should not describe those ideas as original. The useful question is narrower: can a small pre-dispatch workflow preserve Geoapify evidence and make uncertainty easier to act on?

The table below records capabilities described in vendors' own documentation. It is not an independent accuracy test, market survey, or endorsement, and it intentionally omits adoption and performance claims that were not verified.

## Relevant products

| Product | Verified existing functionality | Consequence for Yaki positioning |
|---|---|---|
| [Google Address Validation API](https://developers.google.com/maps/documentation/address-validation/reference/rest) | Parses an address, returns component correctness information, a geocode, and an overall deliverability-related verdict. Its response documentation includes completeness, inferred/replaced/unconfirmed component signals and granularity; US/PR requests can optionally use CASS processing. | Yaki must not claim that verdict-driven validation, component review, correction, or geocoding is novel. Geoapify geocoding confidence is also not equivalent to Google's documented validation verdict. |
| [Smarty Address Verification](https://www.smarty.com/product-pairing/address-verification-autocomplete) and [bulk list validation](https://www.smarty.com/products/list) | Autocomplete, authoritative-database verification, correction of missing/invalid components, deliverability checks, batch/list workflows, metadata, persistent address identifiers, and geocodes are established features. | CSV/bulk cleanup, suggestion, correction, and “is it deliverable?” workflows are not original ideas. Yaki should not imply parity with postal verification. |
| [Loqate International Batch Cleanse](https://docs.loqate.com/api-reference/address-verify/international-batch-cleanse) | Structured or address-line inputs, verification/cleansing, address verification and quality codes, optional geocoding, international formatting, input echoing, multiple matches, and batch processing are documented. | Multiple matches, batch review, quality scoring, and corrected structured output are prior art. Yaki's use of open geospatial evidence and review trace must be the focus. |
| [Melissa Global Address Verification](https://developer.melissa.com/apis/global-address-verification) | Real-time validation/correction, component parsing, coordinates, transliteration, mailing-label formatting, result codes, and global coverage are documented. Melissa also offers single lookup, batch cleansing, and APIs. | Parsing, normalization, correction, internationalization, and batch exports are mature commodity capabilities. Yaki cannot call itself a postal-standardization engine. |
| [Amazon Location Service Places](https://docs.aws.amazon.com/location/latest/developerguide/places.html) | Geocode, reverse geocode, autocomplete, suggestions, free-text place search, nearby search, and place details are offered; requests can apply geographic bias/filtering. | Candidate search, ranking, POI context, and autocomplete are common geospatial platform functions, not a unique Yaki invention. |
| [Onfleet proof of delivery and delivery operations](https://onfleet.com/proof-of-delivery) | Driver workflows, route optimization, tracking/visibility, notifications, and proof of delivery via photo, barcode, signature, ID, and notes are established last-mile capabilities. | Yaki is not a dispatch management, route optimization, driver tracking, or proof-of-delivery system. “Before dispatch” should remain a clear boundary. |

## Functions Yaki must not claim as original

- Forward/reverse geocoding and address autocomplete
- Address parsing, formatting, standardization, correction, and component comparison
- Confidence, quality, validation, or match codes
- Multiple candidate presentation and user selection
- CSV/list/batch address processing and export
- Postal deliverability checks or CASS/official-dataset verification
- Nearby-place context and map-based review
- Route optimization, driver tracking, and proof of delivery
- Human-in-the-loop review in the broad sense

## Meaningful distinction available to Yaki

Yaki can still offer a coherent combination aimed at a neglected operating moment: a small delivery team deciding whether a destination deserves attention **before** dispatch. The meaningful distinction is a workflow and evidence model, not a new geocoding primitive:

1. Preserve the original customer text and show several Geoapify candidates rather than silently accepting rank 1.
2. Explain why a row was flagged using named, raw signals: missing candidate, coarse result type, parsed/requested type mismatch, low component confidence, close competing candidates, or direct/MCP disagreement.
3. Separate service failures from geographic uncertainty.
4. Require an explicit human disposition: accepted candidate, manually corrected, unresolved, or deferred for customer contact.
5. Export an audit-friendly record containing original value, selected value, coordinate, evidence, reviewer action, timestamp, and unresolved notes.
6. Make a direct-API/MCP comparison and tool trace part of the competition experiment, with honest reporting of where agent orchestration helps or adds failure modes.

This combination may be useful and understandable for small operators, but its distinctiveness remains **unverified with users**. It is a product hypothesis, not a novelty claim.

## Competitive gaps and positioning rules

- Geoapify's documented confidence is geocoding match evidence, not the authoritative postal/deliverability verification advertised by Google, Smarty, Loqate, or Melissa.
- Yaki should use “investigate,” “review,” “candidate,” and “unresolved”; avoid “verified,” “deliverable,” “guaranteed,” “rooftop accurate,” and “driver safe” unless a future provider contract specifically supports the claim.
- Yaki should not compete with full last-mile platforms on routing, dispatch, driver apps, tracking, notifications, or proof of delivery in the MVP.
- A simple interface and explainable uncertainty policy may be valuable, but competitors also offer user-friendly tools. Usability must be demonstrated through testing rather than claimed.

## Research limitations

- Vendor claims were not independently validated.
- Pricing, coverage, and plan limits were not normalized because they change and are not needed to establish prior art.
- This was not a patent search, legal originality opinion, or exhaustive market survey.
- User demand and willingness to change workflows remain untested.
