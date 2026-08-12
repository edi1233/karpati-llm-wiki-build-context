from app.main import assess_package, parse_packages_index, parse_repos


def test_parse_repos():
    repos = parse_repos("test|https://example.invalid/debian|stable|main")
    assert repos[0].name == "test"
    assert repos[0].packages_urls[0].endswith("/dists/stable/main/binary-amd64/Packages.xz")


def test_parse_packages_index_multiline_description():
    records = parse_packages_index(
        "Package: demo\nVersion: 1\nArchitecture: amd64\nDescription: first\n second\n\n"
    )
    assert records == [
        {
            "Package": "demo",
            "Version": "1",
            "Architecture": "amd64",
            "Description": "first\nsecond",
        }
    ]


def test_security_assessment_flags_missing_hash():
    status, findings = assess_package({"Package": "demo", "Filename": "pool/demo.deb"})
    assert status == "failed"
    assert "missing SHA256 checksum" in findings


def test_security_assessment_passes_normal_deb():
    status, findings = assess_package(
        {
            "Package": "demo",
            "Filename": "pool/main/d/demo/demo_1_amd64.deb",
            "SHA256": "a" * 64,
            "Section": "libs",
            "Priority": "optional",
        }
    )
    assert status == "passed"
    assert findings == []
