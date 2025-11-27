def tokenize_text(text: str):
    """Tokenize text using spaCy en_core_web_sm and return a list of tokens."""
    try:
        import spacy
    except Exception as e:
        raise RuntimeError('spaCy is required for tokenization: ' + str(e))

    # load small English model
    try:
        nlp = spacy.load('en_core_web_sm')
    except Exception:
        # fallback to blank English if the small model isn't installed
        nlp = spacy.blank('en')

    doc = nlp(text)
    return [token.text for token in doc]
