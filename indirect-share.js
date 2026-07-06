function main() {
    fetch("http://localhost:3000/api/corporate-groups/26647126/flattened")
        .then(function (corporateGroupResponse) {
            return corporateGroupResponse.json();
        })
        .then(function (corporateGroup) {
            var updatedCorporateGroup = addExactOwnershipPercentages(corporateGroup, [
                {
                    cvr: 26647126,
                    directOwnership: 1,
                },
                {
                    cvr: 14419535,
                    directOwnership: 0.5,
                },
                {
                    cvr: 36463198,
                    directOwnership: 0.5,
                },
                {
                    cvr: 75395728,
                    directOwnership: 0.5,
                },
                {
                    cvr: 78930128,
                    directOwnership: 0.5,
                },
            ]);

            console.log(JSON.stringify(updatedCorporateGroup, null, 2));
        })
        .catch(function (error) {
            console.error("Error:", error);
        });
}

function addExactOwnershipPercentages(corporateGroup, directOwnership) {
    // Build map of CVR -> company
    var companyMap = {};
    for (var i = 0; i < corporateGroup.length; i++) {
        companyMap[corporateGroup[i].cvr] = corporateGroup[i];
    }

    // Build map of CVR -> directOwnership
    var directOwnershipMap = {};
    for (var j = 0; j < directOwnership.length; j++) {
        var val = directOwnership[j].directOwnership;
        if (isNaN(val)) val = null;
        directOwnershipMap[directOwnership[j].cvr] = val;
    }

    var result = [];

    for (var k = 0; k < corporateGroup.length; k++) {
        var company = corporateGroup[k];

        // Get direct ownership: user input > interval.min > 1
        var directOwn = directOwnershipMap[company.cvr];

        // Level 0 companies
        if (company.level === 0) {
            result.push({
                cvr: company.cvr,
                name: company.name,
                level: company.level,
                parent: company.parent,
                corporateForm: company.corporateForm,
                ownershipPercentage: { directOwnership: 1, indirectOwnership: 1 },
            });
            continue;
        }

        // Calculate indirect ownership
        var indirectOwn = directOwn;
        var currentParent = company.parent;
        while (currentParent) {
            var parentCompany = companyMap[currentParent.cvr];
            if (parentCompany && parentCompany.level > 0) {
                var parentInterval =
                    parentCompany.ownershipPercentage && parentCompany.ownershipPercentage.interval
                        ? parentCompany.ownershipPercentage.interval
                        : null;

                var parentOwnership = directOwnershipMap[parentCompany.cvr];
                if (parentOwnership == null)
                    parentOwnership = parentInterval && parentInterval.min != null ? parentInterval.min : 1;

                indirectOwn *= parentOwnership;
            }

            currentParent = parentCompany && parentCompany.parent ? parentCompany.parent : null;
        }

        result.push({
            cvr: company.cvr,
            name: company.name,
            level: company.level,
            parent: company.parent,
            corporateForm: company.corporateForm,
            ownershipPercentage: { directOwnership: directOwn, indirectOwnership: indirectOwn },
        });
    }

    return result;
}

main();
